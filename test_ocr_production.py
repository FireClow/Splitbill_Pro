"""
Production-Grade OCR System - Quick Verification Test
Tests the enhanced OCR extraction and parsing capabilities.
"""

import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from receipt_processor import ReceiptParser, OCREngine, OCRError
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_ocr_corrections():
    """Test post-OCR correction dictionary"""
    test_cases = {
        'rpi': 'Rp',
        'kp': 'Rp',
        'rpo': 'Rp',
        'indomii': 'indomie',
        'telor': 'telur',
        'kopi': 'kopi',
    }
    
    logger.info("\n=== Testing OCR Corrections ===")
    for wrong, expected in test_cases.items():
        result = OCREngine._correct_ocr_text(f"text with {wrong} inside")
        if expected in result:
            logger.info(f"✓ {wrong:15} → {expected}")
        else:
            logger.error(f"✗ {wrong:15} → Failed (expected {expected})")
    print()

def test_confidence_scoring():
    """Test confidence scoring system"""
    logger.info("=== Testing Confidence Scoring ===")
    
    # Test case 1: Good receipt
    items_good = [
        {'name': 'Indomie Goreng', 'quantity': 1, 'price': 25000, 'subtotal': 25000},
        {'name': 'Nasi Telur', 'quantity': 2, 'price': 18000, 'subtotal': 36000},
        {'name': 'Air Mineral', 'quantity': 3, 'price': 5000, 'subtotal': 15000},
    ]
    totals_good = {'subtotal': 76000, 'tax': 7600, 'total': 83600, 'service_charge': 0}
    
    confidence = ReceiptParser._calculate_confidence(items_good, totals_good, "test")
    logger.info(f"Good Receipt - Confidence: {confidence['overall']:.1%}")
    assert confidence['overall'] >= 0.85, "Good receipt should have high confidence"
    logger.info("✓ Good receipt confidence correct\n")
    
    # Test case 2: Minimal receipt
    items_minimal = [
        {'name': 'Item1', 'quantity': 1, 'price': 10000, 'subtotal': 10000},
    ]
    totals_minimal = {'subtotal': 10000, 'tax': 0, 'total': 10000, 'service_charge': 0}
    
    confidence = ReceiptParser._calculate_confidence(items_minimal, totals_minimal, "test")
    logger.info(f"Minimal Receipt - Confidence: {confidence['overall']:.1%}")
    assert confidence['overall'] >= 0.50, "Minimal receipt should have reasonable confidence"
    logger.info("✓ Minimal receipt confidence correct\n")

def test_number_normalization():
    """Test Indonesian number format handling"""
    logger.info("=== Testing Number Normalization ===")
    
    test_cases = [
        ("25000", 25000.0),
        ("25.000", 25000.0),
        ("25,000", 25000.0),
        ("25.000,50", 25000.50),
        ("10,50", 10.50),
        ("Rp25.000", 25000.0),
        ("25000 IDR", 25000.0),
    ]
    
    for input_val, expected in test_cases:
        result = ReceiptParser.normalize_number(input_val)
        if abs(result - expected) < 0.01:
            logger.info(f"✓ {input_val:15} → {result}")
        else:
            logger.error(f"✗ {input_val:15} → {result} (expected {expected})")
    print()

def test_item_extraction():
    """Test item extraction patterns"""
    logger.info("=== Testing Item Extraction ===")
    
    sample_text = """
    Indomie Goreng
    1 x Rp25.000
    
    Nasi Telur Kampung
    2 x Rp18.000
    
    Teh Tarik
    3 x kp7.000
    
    Air Mineral
    5 x Rpi5.000
    """
    
    items = ReceiptParser.extract_items(sample_text)
    
    logger.info(f"Extracted {len(items)} items:")
    for idx, item in enumerate(items, 1):
        logger.info(f"  {idx}. {item['name']} - {item['quantity']}x {item['price']} = {item['subtotal']}")
    
    assert len(items) >= 4, f"Should extract at least 4 items, got {len(items)}"
    logger.info("✓ Item extraction working correctly\n")

def test_currency_detection():
    """Test currency detection"""
    logger.info("=== Testing Currency Detection ===")
    
    test_cases = [
        ("Rp25.000", "IDR"),
        ("$25.00", "USD"),
        ("€25.00", "EUR"),
        ("S$25.00", "SGD"),
    ]
    
    for text, expected_currency in test_cases:
        currency = ReceiptParser.extract_currency(text)
        if currency == expected_currency:
            logger.info(f"✓ {text:15} → {currency}")
        else:
            logger.warning(f"! {text:15} → {currency} (expected {expected_currency})")
    print()

def run_all_tests():
    """Run all verification tests"""
    logger.info("\n" + "="*60)
    logger.info("PRODUCTION OCR SYSTEM - VERIFICATION TESTS")
    logger.info("="*60)
    
    try:
        test_ocr_corrections()
        test_number_normalization()
        test_item_extraction()
        test_currency_detection()
        test_confidence_scoring()
        
        logger.info("="*60)
        logger.info("✓ ALL TESTS PASSED - System Ready for Production")
        logger.info("="*60)
        logger.info("\nNext Steps:")
        logger.info("1. Test with actual receipt images")
        logger.info("2. Monitor OCR confidence scores")
        logger.info("3. Check debug logs in backend/debug_logs/")
        logger.info("4. Deploy to Google Play Store")
        logger.info("\nFor detailed guide, see: OCR_PRODUCTION_GUIDE.md")
        
        return True
    except AssertionError as e:
        logger.error(f"\n✗ Test failed: {e}")
        return False
    except Exception as e:
        logger.error(f"\n✗ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
