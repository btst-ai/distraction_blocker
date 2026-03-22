#!/usr/bin/env python3
"""
Fix Arabic transcriptions using proper romanization
Improved algorithm that handles common Arabic patterns
"""

import csv
import os
import time
import re

# Arabic to Latin transliteration mapping
ARABIC_TO_LATIN = {
    # Letters
    'ا': 'a', 'أ': 'a', 'إ': 'i', 'آ': 'aa',
    'ب': 'b', 'ت': 't', 'ث': 'th', 'ج': 'j',
    'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'dh',
    'ر': 'r', 'ز': 'z', 'س': 's', 'ش': 'sh',
    'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z',
    'ع': "'", 'غ': 'gh', 'ف': 'f', 'ق': 'q',
    'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n',
    'ه': 'h', 'و': 'w', 'ي': 'y', 'ى': 'a',
    'ة': 'ah', 'ت': 't', 'ئ': 'y', 'ء': "'",
    # Diacritics
    'َ': 'a', 'ُ': 'u', 'ِ': 'i', 'ً': 'an',
    'ٌ': 'un', 'ٍ': 'in', 'ّ': '', 'ْ': '',
    # Punctuation
    ' ': ' ', '-': '-', '،': ',', '؟': '?',
    # Numbers
    '٠': '0', '١': '1', '٢': '2', '٣': '3',
    '٤': '4', '٥': '5', '٦': '6', '٧': '7',
    '٨': '8', '٩': '9'
}

def transliterate_arabic(text):
    """Convert Arabic text to Latin with improved pattern handling"""
    if not text:
        return ''
    
    # Handle common prefixes and patterns
    # "ل" at start often means "to" or "for" = "li-"
    if text.startswith('ل'):
        # Check if it's followed by another letter (not just "ل" alone)
        if len(text) > 1 and text[1] not in ' \t':
            text = 'li-' + text[1:]
    
    # Handle definite article "ال" = "al-"
    text = re.sub(r'^ال', 'al-', text)
    text = re.sub(r'\s+ال', ' al-', text)
    
    result = []
    i = 0
    while i < len(text):
        char = text[i]
        
        if char in ARABIC_TO_LATIN:
            translit = ARABIC_TO_LATIN[char]
            result.append(translit)
        else:
            result.append(char)
        
        i += 1
    
    # Join and clean up
    transliterated = ''.join(result)
    
    # Clean up spacing
    transliterated = ' '.join(transliterated.split())
    
    # Improve readability: add vowels where needed for common patterns
    # Handle "li-" prefix better
    transliterated = re.sub(r'\bli-([bcdfghjklmnpqrstvwxyz])', r'li-\1', transliterated)
    
    # Handle common consonant clusters by adding 'a' where appropriate
    # This is a simplification - full transliteration would need more rules
    transliterated = re.sub(r'([bcdfghjklmnpqrstvwxyz])([bcdfghjklmnpqrstvwxyz])([bcdfghjklmnpqrstvwxyz])', 
                           r'\1a\2\3', transliterated)
    
    # Handle "al-" definite article
    transliterated = re.sub(r'\bal([bcdfghjklmnpqrstvwxyz])', r'al-\1', transliterated)
    
    # Clean up multiple hyphens
    transliterated = re.sub(r'-+', '-', transliterated)
    
    return transliterated.strip()

def get_arabic_transcription(text):
    """Get proper Latin transcription for Arabic text"""
    if not text or not text.strip():
        return ''
    
    text_clean = text.strip()
    
    try:
        transcription = transliterate_arabic(text_clean)
        return transcription
    except Exception as e:
        print(f"    ⚠️  Error getting transcription for '{text_clean}': {e}")
        return ''

def fix_arabic_csv():
    """Fix transcriptions in Arabic vocabulary CSV file"""
    base_dir = os.path.dirname(os.path.abspath(__file__))
    filename = 'voc_en_ar.csv'
    filepath = os.path.join(base_dir, filename)
    
    if not os.path.exists(filepath):
        print(f"❌ File not found: {filename}")
        return
    
    print(f"\n{'='*60}")
    print(f"📝 Fixing Arabic transcriptions with improved pattern handling")
    print(f"{'='*60}")
    
    rows = []
    total = 0
    fixed = 0
    
    # Read existing CSV
    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        header = next(reader)
        rows.append(header)
        
        for row in reader:
            if len(row) < 2:
                continue
            
            total += 1
            english = row[0].strip()
            translation = row[1].strip() if len(row) > 1 else ''
            old_transcription = row[2].strip() if len(row) > 2 else ''
            similar = row[3].strip() if len(row) > 3 else '0'
            
            # Skip if translation is empty
            if not translation:
                rows.append([english, translation, old_transcription, similar])
                continue
            
            # Get new transcription
            transcription = old_transcription
            if translation:
                if total % 100 == 0:
                    print(f"  Progress: {total} words processed, {fixed} transcriptions fixed...")
                
                new_transcription = get_arabic_transcription(translation)
                if new_transcription and new_transcription != old_transcription:
                    transcription = new_transcription
                    fixed += 1
                elif not new_transcription:
                    transcription = old_transcription
                time.sleep(0.001)
            
            rows.append([english, translation, transcription, similar])
    
    # Write back
    with open(filepath, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerows(rows)
    
    print(f"  ✅ Completed: {total} words, {fixed} transcriptions fixed")
    print(f"  📄 Updated {filename}")

if __name__ == '__main__':
    fix_arabic_csv()
    print(f"\n{'='*60}")
    print("✅ Arabic transcriptions fixed!")
    print(f"{'='*60}")
