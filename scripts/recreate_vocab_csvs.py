#!/usr/bin/env python3
"""
Recreate vocabulary CSV files from enwordlist.csv
Format: English, Translation, Transcription (if non-Latin), Similarity
"""

import csv
import re
import os
import time

# Try to import translation library
try:
    from deep_translator import GoogleTranslator
    HAS_TRANSLATOR = True
except ImportError:
    print("⚠️  deep_translator not installed. Installing...")
    import subprocess
    subprocess.check_call(['pip3', 'install', 'deep-translator'])
    from deep_translator import GoogleTranslator
    HAS_TRANSLATOR = True

# Language code mapping
LANG_MAP = {
    'en_fr': 'fr',  # English to French
    'en_de': 'de',  # English to German
    'en_es': 'es',  # English to Spanish
    'en_it': 'it',  # English to Italian
    'en_ar': 'ar',  # English to Arabic
    'en_ko': 'ko',  # English to Korean
    'en_ja': 'ja',  # English to Japanese
    'en_uk': 'uk',  # English to Ukrainian
    'en_pt': 'pt',  # English to Portuguese
    'en_vi': 'vi',  # English to Vietnamese
}

# Languages that need transcription (non-Latin alphabet, EXCEPT Vietnamese)
TRANSCRIPTION_LANGS = ['en_ar', 'en_ko', 'en_ja', 'en_uk']

def are_cognates(english, translation):
    """Check if words are cognates (very similar)"""
    # Remove articles/prepositions for comparison
    eng_clean = re.sub(r'^(the|a|an|to)\s+', '', english.lower().strip())
    trans_clean = re.sub(r'[^\w]', '', translation.lower().strip())
    
    if len(eng_clean) < 3 or len(trans_clean) < 3:
        return '0'
    
    # Check if first 3-4 chars match
    min_len = min(len(eng_clean), len(trans_clean))
    if min_len >= 4:
        if eng_clean[:4] == trans_clean[:4]:
            return '1'
        if eng_clean[:3] == trans_clean[:3] and min_len <= 6:
            return '1'
    
    # Common cognate patterns
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
        (r'^restaurant', r'^restaurant'),
        (r'^information', r'^information'),
        (r'^problem', r'^problem'),
        (r'^system', r'^system'),
    ]
    
    for pattern_eng, pattern_trans in cognate_patterns:
        if re.match(pattern_eng, eng_clean) and re.match(pattern_trans, trans_clean):
            return '1'
    
    return '0'

def translate_word(translator, word, max_retries=3):
    """Translate a word with retry logic"""
    for attempt in range(max_retries):
        try:
            translation = translator.translate(word)
            time.sleep(0.2)  # Rate limiting
            return translation
        except Exception as e:
            if attempt < max_retries - 1:
                time.sleep(2)
                continue
            print(f"    ⚠️  Failed to translate '{word}': {e}")
            return ''
    return ''

def recreate_csv(lang_code, english_words):
    """Recreate a vocabulary CSV file with translations"""
    base_dir = os.path.dirname(os.path.abspath(__file__))
    filename = f'voc_{lang_code}.csv'
    filepath = os.path.join(base_dir, filename)
    
    target_lang = LANG_MAP.get(lang_code, 'en')
    has_transcription = lang_code in TRANSCRIPTION_LANGS
    
    print(f"\n{'='*60}")
    print(f"🌍 Starting: {lang_code} -> {target_lang}")
    print(f"{'='*60}")
    
    # Initialize translator
    translator = GoogleTranslator(source='en', target=target_lang)
    
    rows = []
    if has_transcription:
        rows.append(['English', 'Translation', 'Transcription', 'Similar'])
    else:
        rows.append(['English', 'Translation', '', 'Similar'])
    
    # Process each English word
    total = len(english_words)
    translated_count = 0
    failed_count = 0
    
    for i, english in enumerate(english_words, 1):
        if not english or english.lower() in ['english', 'word', 'englishwitharticle']:
            continue
        
        if i % 100 == 0:
            print(f"  Progress: {i}/{total} words translated ({translated_count} successful, {failed_count} failed)...")
        
        # Translate
        translation = translate_word(translator, english)
        
        if translation:
            translated_count += 1
            translation_clean = translation.strip()
            
            # Get transcription if needed (for non-Latin languages except Vietnamese)
            transcription = ''
            if has_transcription:
                # For now, transcription will be empty - we'd need a transliteration service
                # The translation service might provide it in some cases
                transcription = ''
            
            # Check for cognates
            similar = are_cognates(english, translation_clean)
            
            if has_transcription:
                rows.append([english, translation_clean, transcription, similar])
            else:
                rows.append([english, translation_clean, '', similar])
        else:
            failed_count += 1
            # Add row with empty translation
            if has_transcription:
                rows.append([english, '', '', '0'])
            else:
                rows.append([english, '', '', '0'])
    
    # Write CSV
    with open(filepath, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerows(rows)
    
    print(f"  ✅ Completed {lang_code}: {len(rows)-1} words ({translated_count} translated, {failed_count} failed)")
    print(f"  📄 Saved to {filename}")

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    enwordlist_path = os.path.join(base_dir, 'enwordlist.csv')
    
    # Read English words from enwordlist.csv (second column - keep "the" and "to")
    english_words = []
    with open(enwordlist_path, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        for row in reader:
            if len(row) >= 2:
                word = row[1].strip()  # Second column - keep as-is with "the" and "to"
                if word and word.lower() not in ['english', 'word', 'englishwitharticle']:
                    english_words.append(word)
    
    print(f"📚 Found {len(english_words)} English words from enwordlist.csv")
    print("🚀 Starting translation process...\n")
    
    # Language codes to recreate (excluding fr_gr)
    lang_codes = ['en_fr', 'en_de', 'en_es', 'en_it', 'en_ar', 'en_ko', 'en_ja', 'en_uk', 'en_pt', 'en_vi']
    
    for lang_code in lang_codes:
        recreate_csv(lang_code, english_words)
        if lang_code != lang_codes[-1]:  # Don't sleep after last language
            print("\n⏸️  Pausing 3 seconds before next language...")
            time.sleep(3)
    
    print(f"\n{'='*60}")
    print("✅ ALL vocabulary CSV files created!")
    print(f"{'='*60}")

if __name__ == '__main__':
    main()
