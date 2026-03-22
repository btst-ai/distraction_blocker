#!/usr/bin/env python3
"""
Update vocabulary CSV files with:
1. English words with articles/prepositions (to for verbs, the for nouns, etc.)
2. Cognate column (1 if words are very similar, 0 otherwise)
3. Transcription column (Latin alphabet transcription, extracted from parentheses)
"""

import csv
import re
import os

# Common verb endings and patterns
VERB_INDICATORS = ['accept', 'achieve', 'add', 'agree', 'allow', 'answer', 'appear', 'apply', 
                   'arrive', 'ask', 'avoid', 'become', 'begin', 'believe', 'belong', 'break',
                   'bring', 'build', 'buy', 'call', 'carry', 'catch', 'change', 'choose',
                   'come', 'consider', 'continue', 'create', 'decide', 'describe', 'develop',
                   'die', 'discover', 'discuss', 'do', 'draw', 'drink', 'drive', 'eat', 'end',
                   'enjoy', 'enter', 'explain', 'fall', 'feel', 'find', 'finish', 'follow',
                   'forget', 'forgive', 'get', 'give', 'go', 'grow', 'happen', 'have', 'hear',
                   'help', 'hide', 'hold', 'hope', 'include', 'increase', 'introduce', 'invite',
                   'join', 'keep', 'kill', 'know', 'laugh', 'learn', 'leave', 'let', 'lie',
                   'like', 'listen', 'live', 'look', 'lose', 'love', 'make', 'manage', 'mean',
                   'meet', 'move', 'need', 'notice', 'offer', 'open', 'order', 'own', 'pass',
                   'pay', 'pick', 'play', 'prefer', 'prepare', 'present', 'prevent', 'produce',
                   'promise', 'protect', 'provide', 'pull', 'push', 'put', 'reach', 'read',
                   'realize', 'receive', 'recognize', 'recommend', 'record', 'reduce', 'refuse',
                   'regret', 'remember', 'remind', 'remove', 'repeat', 'replace', 'reply',
                   'report', 'represent', 'require', 'return', 'ride', 'ring', 'rise', 'run',
                   'save', 'say', 'see', 'seem', 'sell', 'send', 'serve', 'set', 'shake',
                   'share', 'shoot', 'show', 'shut', 'sing', 'sit', 'sleep', 'smile', 'smoke',
                   'solve', 'speak', 'spend', 'stand', 'start', 'stay', 'steal', 'stick',
                   'stop', 'study', 'succeed', 'suggest', 'supply', 'support', 'suppose',
                   'surprise', 'take', 'talk', 'teach', 'tell', 'think', 'throw', 'touch',
                   'train', 'travel', 'treat', 'try', 'turn', 'understand', 'use', 'visit',
                   'wait', 'wake', 'walk', 'want', 'warn', 'wash', 'watch', 'wear', 'win',
                   'wish', 'work', 'worry', 'write']

# Common noun patterns (words that are typically nouns)
NOUN_INDICATORS = ['ability', 'action', 'adult', 'advice', 'air', 'amount', 'animal', 'answer',
                   'area', 'arm', 'art', 'article', 'aspect', 'back', 'bag', 'ball', 'bank',
                   'bar', 'base', 'bath', 'bed', 'beginning', 'behaviour', 'bell', 'bill',
                   'bird', 'bit', 'block', 'blood', 'board', 'boat', 'body', 'book', 'boot',
                   'bottle', 'box', 'boy', 'branch', 'bread', 'break', 'breakfast', 'breath',
                   'bridge', 'brother', 'brush', 'building', 'bus', 'business', 'butter',
                   'button', 'cake', 'call', 'camera', 'camp', 'can', 'car', 'card', 'care',
                   'case', 'cat', 'cause', 'cent', 'centre', 'century', 'chain', 'chair',
                   'chance', 'change', 'chapter', 'character', 'charge', 'cheek', 'cheese',
                   'chest', 'chicken', 'child', 'chin', 'choice', 'church', 'circle', 'city',
                   'class', 'clay', 'clock', 'cloth', 'clothes', 'cloud', 'coal', 'coat',
                   'coffee', 'coin', 'cold', 'collar', 'colour', 'comb', 'comfort', 'company',
                   'condition', 'connection', 'control', 'cook', 'copper', 'copy', 'cord',
                   'cork', 'corn', 'corner', 'cost', 'cotton', 'cough', 'country', 'course',
                   'cover', 'cow', 'crack', 'credit', 'crime', 'crop', 'cross', 'crowd',
                   'crown', 'crush', 'cry', 'cup', 'current', 'curtain', 'curve', 'cushion',
                   'damage', 'danger', 'dark', 'date', 'daughter', 'day', 'death', 'debt',
                   'decision', 'degree', 'design', 'desire', 'desk', 'detail', 'development',
                   'digestion', 'dinner', 'direction', 'dirt', 'discussion', 'disease', 'disgust',
                   'distance', 'distribution', 'division', 'dog', 'door', 'doubt', 'drain',
                   'drawer', 'dress', 'drink', 'driving', 'drop', 'dust', 'ear', 'earth',
                   'edge', 'education', 'effect', 'egg', 'end', 'energy', 'engine', 'error',
                   'event', 'example', 'exchange', 'existence', 'expansion', 'experience',
                   'expert', 'eye', 'face', 'fact', 'fall', 'family', 'farm', 'father',
                   'fear', 'feather', 'feeling', 'field', 'finger', 'fire', 'fish', 'flag',
                   'flame', 'flight', 'floor', 'flower', 'fly', 'fold', 'food', 'foot',
                   'force', 'form', 'frame', 'friend', 'front', 'fruit', 'fuel', 'fun',
                   'garden', 'gate', 'girl', 'glass', 'glove', 'goat', 'gold', 'government',
                   'grain', 'grass', 'grip', 'group', 'growth', 'guide', 'gun', 'hair',
                   'half', 'hall', 'hammer', 'hand', 'handle', 'harbour', 'harm', 'hat',
                   'head', 'health', 'hearing', 'heart', 'heat', 'help', 'high', 'history',
                   'hole', 'holiday', 'home', 'honey', 'hook', 'hope', 'horn', 'horse',
                   'hospital', 'hour', 'house', 'humour', 'ice', 'idea', 'impulse', 'increase',
                   'industry', 'ink', 'insect', 'instrument', 'insurance', 'interest', 'iron',
                   'island', 'jelly', 'jewel', 'join', 'journey', 'judge', 'jump', 'kettle',
                   'key', 'kick', 'kiss', 'knee', 'knife', 'knot', 'knowledge', 'land',
                   'language', 'laugh', 'law', 'lead', 'leaf', 'learning', 'leather', 'leg',
                   'letter', 'level', 'library', 'lift', 'light', 'limit', 'line', 'linen',
                   'lip', 'liquid', 'list', 'look', 'loss', 'love', 'machine', 'magic',
                   'mail', 'man', 'map', 'mark', 'market', 'mass', 'match', 'material',
                   'meal', 'measure', 'meat', 'meeting', 'memory', 'metal', 'middle', 'milk',
                   'mind', 'mine', 'minute', 'mist', 'money', 'monkey', 'month', 'moon',
                   'morning', 'mother', 'motion', 'mountain', 'mouth', 'move', 'muscle',
                   'music', 'nail', 'name', 'nation', 'neck', 'need', 'needle', 'nerve',
                   'net', 'news', 'night', 'noise', 'nose', 'note', 'number', 'observation',
                   'offer', 'office', 'oil', 'operation', 'opinion', 'orange', 'order',
                   'organization', 'ornament', 'owner', 'page', 'pain', 'paint', 'paper',
                   'part', 'paste', 'payment', 'peace', 'pen', 'pencil', 'person', 'picture',
                   'pig', 'pin', 'pipe', 'place', 'plane', 'plant', 'plate', 'play',
                   'pleasure', 'plough', 'pocket', 'point', 'poison', 'polish', 'porter',
                   'position', 'pot', 'potato', 'powder', 'power', 'price', 'print',
                   'process', 'produce', 'profit', 'property', 'prose', 'protest', 'pull',
                   'pump', 'punishment', 'purpose', 'push', 'quality', 'question', 'quiet',
                   'rail', 'rain', 'range', 'rate', 'ray', 'reaction', 'reading', 'reason',
                   'receipt', 'record', 'regret', 'relation', 'religion', 'representative',
                   'request', 'respect', 'rest', 'reward', 'rhythm', 'rice', 'river', 'road',
                   'rod', 'roll', 'roof', 'room', 'root', 'rub', 'rule', 'run', 'sack',
                   'sail', 'salt', 'sand', 'scale', 'scissors', 'screw', 'sea', 'seat',
                   'secretary', 'seed', 'selection', 'self', 'sense', 'servant', 'shade',
                   'shake', 'shame', 'shape', 'sheep', 'sheet', 'shelf', 'ship', 'shirt',
                   'shock', 'shoe', 'side', 'sign', 'silk', 'silver', 'sink', 'sister',
                   'size', 'skin', 'skirt', 'sky', 'sleep', 'slip', 'slope', 'smash',
                   'smell', 'smile', 'smoke', 'snake', 'sneeze', 'snow', 'soap', 'society',
                   'sock', 'soda', 'sofa', 'soft', 'solid', 'son', 'song', 'sort', 'sound',
                   'soup', 'space', 'spade', 'sponge', 'spoon', 'spring', 'square', 'stage',
                   'stamp', 'star', 'start', 'statement', 'station', 'steam', 'steel',
                   'stem', 'step', 'stick', 'stitch', 'stocking', 'stomach', 'stone', 'stop',
                   'store', 'story', 'stretch', 'street', 'stretch', 'strike', 'string',
                   'structure', 'substance', 'sugar', 'suggestion', 'summer', 'sun', 'support',
                   'surprise', 'sweep', 'swim', 'system', 'table', 'tail', 'talk', 'taste',
                   'tax', 'tea', 'teaching', 'tendency', 'test', 'text', 'theory', 'thing',
                   'thought', 'thread', 'throat', 'thumb', 'thunder', 'ticket', 'tie', 'time',
                   'tin', 'tip', 'toe', 'tooth', 'top', 'touch', 'town', 'trade', 'train',
                   'transport', 'tray', 'tree', 'trick', 'trouble', 'trousers', 'truck',
                   'turn', 'twist', 'umbrella', 'uncle', 'underwear', 'unit', 'use', 'value',
                   'verse', 'vessel', 'view', 'voice', 'walk', 'wall', 'war', 'wash', 'waste',
                   'watch', 'water', 'wave', 'wax', 'way', 'weather', 'week', 'weight',
                   'wheel', 'whip', 'whistle', 'window', 'wine', 'wing', 'winter', 'wire',
                   'woman', 'wood', 'wool', 'word', 'work', 'worm', 'wound', 'wrist',
                   'writer', 'writing', 'year', 'yoke', 'zebra', 'zinc', 'zone']

def is_verb(word):
    """Check if word is likely a verb"""
    word_lower = word.lower().strip()
    # Check against known verb list
    if word_lower in VERB_INDICATORS:
        return True
    # Check common verb endings
    if word_lower.endswith(('ate', 'ify', 'ize', 'ise', 'en')):
        return True
    return False

def is_noun(word):
    """Check if word is likely a noun"""
    word_lower = word.lower().strip()
    # Check against known noun list
    if word_lower in NOUN_INDICATORS:
        return True
    # Check common noun endings
    if word_lower.endswith(('tion', 'sion', 'ness', 'ment', 'ity', 'er', 'or', 'ist')):
        return True
    return False

def add_article(word):
    """Add appropriate article/preposition to English word"""
    word_lower = word.lower().strip()
    
    if is_verb(word_lower):
        return f"to {word}"
    elif is_noun(word_lower):
        # Use "the" for consistency with translations that use definite articles
        return f"the {word}"
    else:
        # For adjectives, adverbs, etc., return as-is
        return word

def are_cognates(english, translation):
    """Check if words are cognates (very similar)"""
    # Remove common prefixes/suffixes and compare
    eng_clean = re.sub(r'^(to|the|a|an)\s+', '', english.lower().strip())
    trans_clean = re.sub(r'[^\w]', '', translation.lower().strip())
    
    # Check if they share significant character overlap
    if len(eng_clean) < 3 or len(trans_clean) < 3:
        return '0'
    
    # Simple similarity check - if first 3-4 chars match
    min_len = min(len(eng_clean), len(trans_clean))
    if min_len >= 4:
        if eng_clean[:4] == trans_clean[:4]:
            return '1'
        if eng_clean[:3] == trans_clean[:3] and min_len <= 6:
            return '1'
    
    # Check for common cognate patterns
    cognate_patterns = [
        (r'^visit', r'^visit'),
        (r'^accept', r'^accept'),
        (r'^action', r'^action'),
        (r'^animal', r'^animal'),
        (r'^music', r'^music'),
        (r'^hotel', r'^hotel'),
        (r'^radio', r'^radio'),
        (r'^telephone', r'^telephone'),
        (r'^computer', r'^computer'),
        (r'^internet', r'^internet'),
    ]
    
    for pattern_eng, pattern_trans in cognate_patterns:
        if re.match(pattern_eng, eng_clean) and re.match(pattern_trans, trans_clean):
            return '1'
    
    return '0'

def extract_transcription(translation):
    """Extract Latin transcription from parentheses or after /"""
    # Pattern: text (transcription) or text / transcription
    match = re.search(r'[\(/]\s*([^\)/]+?)\s*[\)/]', translation)
    if match:
        return match.group(1).strip()
    return ''

def process_english_csv(filename):
    """Process English-based CSV files"""
    rows = []
    with open(filename, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        for row in reader:
            if len(row) < 2:
                continue
            
            # Detect format: old (2 cols) or new (5 cols)
            if len(row) >= 5:
                # Already processed - just update the article if needed
                english = row[0].strip()
                current_article = row[1].strip()
                translation = row[2].strip()
                similar = row[3].strip() if len(row) > 3 else '0'
                transcription = row[4].strip() if len(row) > 4 else ''
                
                # Skip header
                if english.lower() in ['english', 'word']:
                    rows.append([english, 'EnglishWithArticle', translation, 'Similar', 'Transcription'])
                    continue
                
                # Recalculate article (in case we changed from a/an to the)
                english_with_article = add_article(english)
                
                rows.append([english, english_with_article, translation, similar, transcription])
            else:
                # Old format (2 columns): English, Translation
                english = row[0].strip()
                translation = row[1].strip()
                
                # Skip header
                if english.lower() in ['english', 'word'] or translation.lower() in ['translation', 'french', 'german', 'spanish', 'italian', 'arabic', 'korean', 'japanese', 'ukrainian', 'portuguese', 'vietnamese']:
                    # Update header
                    rows.append([english, 'EnglishWithArticle', translation, 'Similar', 'Transcription'])
                    continue
                
                # Add article to English
                english_with_article = add_article(english)
                
                # Extract transcription from translation (format: text / transcription or text (transcription))
                transcription = extract_transcription(translation)
                # Clean translation (remove transcription part)
                if transcription:
                    # Remove / transcription or (transcription) from translation
                    translation_clean = re.sub(r'\s*[/\(]\s*' + re.escape(transcription) + r'\s*[\)/]', '', translation).strip()
                    translation_clean = re.sub(r'\s*[/\(]\s*[^\)/]+?\s*[\)/]', '', translation_clean).strip()
                else:
                    translation_clean = translation.strip()
                
                # Check for cognates (use cleaned translation)
                similar = are_cognates(english, translation_clean)
                
                rows.append([english, english_with_article, translation_clean, similar, transcription])
    
    # Write back
    with open(filename, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerows(rows)
    
    print(f"✓ Updated {filename}")

def process_fr_gr_csv(filename):
    """Process French/Greek CSV file"""
    rows = []
    with open(filename, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        for row in reader:
            if len(row) < 2:
                continue
            greek = row[0].strip()
            french = row[1].strip()
            
            # Skip header
            if greek.lower() in ['greek', 'word'] or french.lower() in ['french', 'translation']:
                rows.append([greek, french, 'Similar', 'Transcription'])
                continue
            
            # Extract transcription (Greek already has Latin transcription)
            transcription = extract_transcription(greek)
            greek_clean = re.sub(r'\s*[\(/]\s*[^\)/]+?\s*[\)/]', '', greek).strip()
            
            # Check for cognates
            similar = are_cognates(greek_clean, french)
            
            rows.append([greek_clean, french, similar, transcription])
    
    # Write back
    with open(filename, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerows(rows)
    
    print(f"✓ Updated {filename}")

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Process all English-based CSVs
    english_csvs = [
        'voc_en_fr.csv',
        'voc_en_de.csv',
        'voc_en_es.csv',
        'voc_en_it.csv',
        'voc_en_ar.csv',
        'voc_en_ko.csv',
        'voc_en_ja.csv',
        'voc_en_uk.csv',
        'voc_en_pt.csv',
        'voc_en_vi.csv',
    ]
    
    for csv_file in english_csvs:
        filepath = os.path.join(base_dir, csv_file)
        if os.path.exists(filepath):
            process_english_csv(filepath)
        else:
            print(f"⚠ File not found: {csv_file}")
    
    # Process French/Greek CSV
    fr_gr_file = os.path.join(base_dir, 'voc_fr_gr.csv')
    if os.path.exists(fr_gr_file):
        process_fr_gr_csv(fr_gr_file)
    else:
        print(f"⚠ File not found: voc_fr_gr.csv")
    
    print("\n✅ All CSV files updated!")

if __name__ == '__main__':
    main()

