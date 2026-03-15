"""
Receipt OCR Processor - Production Grade
Handles image OCR and receipt parsing to extract items, prices, and totals.
Supports Indonesian and English receipts (Indomaret, restoran, cafe, etc.)

Features:
- Advanced image preprocessing (adaptive thresholding, deskewing, denoising)
- Multi-pass OCR with parameter variation and result merging
- Smart post-OCR correction with Indonesian-specific fixes
- Confidence scoring and validation
- Production-ready error handling and detailed logging
"""

import re
from typing import Dict, List, Any
import pytesseract
from PIL import Image, ImageFilter, ImageOps, ImageEnhance, ImageStat
import io
import logging
import os
from datetime import datetime
import numpy as np
from ocr_service import extract_text_google_vision, get_ocr_runtime_status

logger = logging.getLogger("receipt_processor")

# Debug file path
DEBUG_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "debug_logs")
os.makedirs(DEBUG_DIR, exist_ok=True)

class ReceiptParser:
    """Parse OCR text from receipt images into structured bill data."""
    
    # Regex patterns untuk Indonesia & English receipts
    CURRENCY_PATTERNS = {
        'IDR': r'(?:Rp|RP|IDR|idr|rp)',
        'USD': r'(?:\$|USD|usd)',
        'SGD': r'(?:S\$|SGD|sgd)',
        'EUR': r'(?:€|EUR|eur)',
    }
    
    # Pattern untuk detect item line: quantity x price = total
    ITEM_PATTERN = r'(.*?)\s+(\d+)\s*x?\s*([\d.,]+)\s*[=x]?\s*([\d.,]+)?'
    
    # Pattern untuk detect subtotal, tax, service charge
    SUBTOTAL_PATTERN = r'(subtotal|sub total|total item|pesanan|amount|sub.total)[\s:]+([\d.,]+)'
    TAX_PATTERN = r'(pajak|tax|ppn|pph|service|svc|charge)[\s:]+([\d.,]+)'
    TOTAL_PATTERN = r'(total|grand total|grand.total|total akhir|total amount|bayar)[\s:]+([\d.,]+)'
    
    @staticmethod
    def normalize_number(value: str) -> float:
        """Convert Indonesian/English number format to float."""
        if not value:
            return 0.0
        value = re.sub(r'(?i)\b(?:rp|idr|usd|eur|sgd|chf)\b', '', value)
        # Remove spaces
        value = value.replace(' ', '')
        # Handle both comma and dot as decimal separator
        # Indonesian format: 10.000,50 (Rp 10.000,50)
        # English format: 10,000.50
        if ',' in value and '.' in value:
            if value.rindex(',') > value.rindex('.'):
                # Indonesian: 10.000,50
                value = value.replace('.', '').replace(',', '.')
            else:
                # English: 10,000.50
                value = value.replace(',', '')
        elif ',' in value:
            # Could be either - guess based on position of numbers after comma
            parts = value.split(',')
            if len(parts[-1]) == 2:
                # Likely decimal: 10,50
                value = value.replace(',', '.')
            else:
                # Likely thousands: 10,000
                value = value.replace(',', '')
        elif '.' in value:
            # Dot-only values can be decimal (5.50) or thousands (25.000, 1.250.000)
            parts = value.split('.')
            if len(parts) > 1 and all(part.isdigit() for part in parts):
                if len(parts[-1]) == 3:
                    value = ''.join(parts)
        # Remove any remaining non-numeric characters except dot
        value = re.sub(r'[^\d.]', '', value)
        try:
            return float(value)
        except ValueError:
            return 0.0
    
    @staticmethod
    def extract_currency(text: str) -> str:
        """Detect currency from text."""
        text_upper = text.upper()
        for currency in ['IDR', 'SGD', 'EUR', 'USD']:
            pattern = ReceiptParser.CURRENCY_PATTERNS[currency]
            if re.search(pattern, text_upper):
                return currency
        return 'USD'  # Default currency
    
    @staticmethod
    def extract_items(text: str) -> List[Dict[str, Any]]:
        """Extract items from receipt text with flexible pattern matching (supports multi-line format)."""
        items = []
        lines = text.split('\n')

        def is_non_item_line(raw_line: str) -> bool:
            line = raw_line.strip().lower()
            if not line:
                return True

            ignored_keywords = [
                'subtotal', 'sub total', 'total', 'grand total', 'total item',
                'tax', 'pajak', 'ppn', 'service', 'svc', 'charge',
                'qris', 'qr', 'debit', 'kredit', 'credit', 'cash', 'bayar',
                'kembalian', 'change', 'diskon', 'discount', 'promo',
                'terima kasih', 'thank you', 'whatsapp', 'instagram',
                'alamat', 'address', 'invoice', 'nota', 'pelanggan', 'transaksi',
                'nomor meja', 'karyawan', 'dine in', 'take away',
            ]

            if any(keyword in line for keyword in ignored_keywords):
                return True

            # Lines with only separators, timestamps, or metadata should not be treated as items.
            if re.match(r'^[\d\s/\-:=.]+$', line) or re.match(r'^[=\-_*]+$', line):
                return True

            # Ignore lines that are mostly payment totals/currency amounts with minimal text.
            if re.match(r'^(rp|idr)?\s*[\d.,]+\s*$', line):
                return True

            return False
        
        # Skip keywords for header/footer/totals
        skip_keywords = ['tanggal', 'waktu', 'kasir', 'thank', 'terima', 'no.', 'invoice', 'nota', 
                   'alamat', 'address', 'phone', 'telp', 'pelanggan', 'nomor meja', 'transaksi',
                   'diskon', 'discount', 'bayar', 'cash', 'card', 'kembalian', 'change', 
                   'subtotal', 'sub total', 'pajak', 'tax', 'service', 'grand total', 
                   'total', 'qris', 'qris bni', 'terima kasih', 'whatsapp', 'instagram', 'karyawan',
                   'markop', 'raya belong', 'jakarta', 'dine in', 'hedan']
        
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            i += 1
            
            if not line or len(line) < 3:
                continue
            
            # Skip header/footer/total lines
            if is_non_item_line(line) or any(skip in line.lower() for skip in skip_keywords):
                continue
            
            name = None
            qty = 1
            price = 0.0
            
            # PATTERN 1: Single-line with total price "Kampung 1/2 Mateng) 1 x Rp8.000 Rp8.000+"
            match = re.match(r'(.+?)\s+(\d+)\s*[xX×]\s*[Rr][Pp]\s*([\d.,]+)\s*[Rr][Pp]\s*([\d.,]+)\+?', line)
            if match:
                name = match.group(1).strip()
                qty = int(match.group(2))
                price = ReceiptParser.normalize_number(match.group(3))  # Use unit price (group 3)

            # PATTERN 1B: European-style line with quantity prefix, e.g.
            # "2xLatte Macchiato  a  4.50 CHF  9.00"
            if not name:
                match = re.match(
                    r'^(\d+)\s*[xX×]\s*([A-Za-z][^\d]{1,80}?)\s*(?:a|@|à)?\s*([\d.,]+)\s*(?:[A-Z]{3}|Rp|IDR|USD|EUR|SGD|CHF)?\s*([\d.,]+)?\s*$',
                    line,
                    re.IGNORECASE,
                )
                if match:
                    qty = int(match.group(1))
                    name = match.group(2).strip()
                    unit_price = ReceiptParser.normalize_number(match.group(3))
                    total_price = ReceiptParser.normalize_number(match.group(4)) if match.group(4) else 0.0
                    if unit_price > 0:
                        price = unit_price
                    elif total_price > 0 and qty > 0:
                        price = total_price / qty
            
            # PATTERN 2: Single-line without total "3 x Rp25.000" (with OCR error tolerance)
            # Handles: kp, rpi, rpo, Rp variations
            if not name:
                match = re.match(r'(.+?)\s+(\d+)\s*[xX×]\s*[RrKk][Pp]?[OoIi]?\s*([\d.,]+)\+?$', line, re.IGNORECASE)
                if match:
                    name = match.group(1).strip()
                    qty = int(match.group(2))
                    price = ReceiptParser.normalize_number(match.group(3))
            
            # PATTERN 3: Single-line "Item Name  Rp50.000" or "Item Name    50000"
            if not name:
                match = re.match(r'(.+?)\s{2,}[Rr][Pp]?\s*([\d.,]+)\+?$', line)
                if match:
                    name = match.group(1).strip()
                    price = ReceiptParser.normalize_number(match.group(2))
            
            # PATTERN 4: Single-line with separator "Item Name - 50000" or "Item Name : 50000"
            if not name:
                match = re.match(r'(.+?)\s*[-:]\s*[Rr][Pp]?\s*([\d.,]+)\+?$', line)
                if match:
                    name = match.group(1).strip()
                    price = ReceiptParser.normalize_number(match.group(2))
            
            # PATTERN 5: MULTI-LINE FORMAT - Current line is item name only
            # Next line has: "3 x Rp25.000" or "1 x Rp18.000" (with OCR error tolerance)
            if not name and i < len(lines):
                next_line = lines[i].strip()
                # Check if next line has quantity x price pattern (handles kp, rpi, rpo, etc.)
                match = re.match(r'(\d+)\s*[xX×]\s*[RrKk][Pp]?[OoIi]?\s*([\d.,]+)\+?', next_line, re.IGNORECASE)
                if match:
                    # Current line is the item name
                    name = line
                    qty = int(match.group(1))
                    price = ReceiptParser.normalize_number(match.group(2))
                    i += 1  # Skip the next line since we already processed it
                    logger.debug(f"[MULTI-LINE] '{name}' + '{next_line}' -> qty={qty}, price={price}")
            
            # PATTERN 6: Find any price at the end without Rp prefix
            if not name:
                match = re.match(r'(.+?)\s+([\d.,]{4,})\+?$', line)
                if match and (',' in match.group(2) or '.' in match.group(2) or len(match.group(2)) >= 4):
                    name = match.group(1).strip()
                    price = ReceiptParser.normalize_number(match.group(2))
            
            # If we found a valid item (name and price > 0)
            if name and price > 0:
                # Clean up name - remove 'Rp/kp/rpi/rpo' prefix, trailing parentheses, etc.
                name = re.sub(r'^[RrKk][Pp]?[OoIi]?\s*', '', name, flags=re.IGNORECASE).strip()
                name = re.sub(r'\)+$', '', name).strip()  # Remove trailing )
                
                # Filter out very short names or pure numbers
                if len(name) < 2 or name.isdigit():
                    continue
                if is_non_item_line(name):
                    continue
                
                logger.debug(f"[MATCH] {name} | qty={qty} | price={price} | subtotal={price * qty}")
                
                items.append({
                    'name': name,
                    'quantity': qty,
                    'price': price,
                    'subtotal': price * qty
                })
        
        return items

    @staticmethod
    def _sanitize_items(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Remove clearly implausible OCR items caused by merged numeric artifacts."""
        if len(items) < 2:
            return items

        positive_prices = [float(item.get('price', 0.0)) for item in items if float(item.get('price', 0.0)) > 0]
        if len(positive_prices) < 2:
            return items

        min_price = min(positive_prices)
        sanitized: List[Dict[str, Any]] = []

        for item in items:
            price = float(item.get('price', 0.0))
            name = str(item.get('name', ''))
            alnum_name = re.sub(r'[^a-zA-Z0-9]', '', name)
            digit_ratio = (sum(ch.isdigit() for ch in alnum_name) / len(alnum_name)) if alnum_name else 0.0

            # Typical OCR failure: long mixed token + price inflated by merged digits.
            suspicious_outlier = (
                price >= 500000
                and min_price > 0
                and (price / min_price) >= 80
                and digit_ratio >= 0.25
            )

            if not suspicious_outlier:
                sanitized.append(item)
            else:
                logger.warning(
                    f"[OCR] Dropping suspicious outlier item: name='{name}', price={price}, min_price={min_price}, digit_ratio={digit_ratio:.2f}"
                )

        # Never drop all items; fallback to original extraction if filtering was too aggressive.
        return sanitized if sanitized else items
    
    @staticmethod
    def extract_totals(text: str) -> Dict[str, float]:
        """Extract subtotal, tax, and total from receipt."""
        totals = {
            'subtotal': 0.0,
            'tax': 0.0,
            'service_charge': 0.0,
            'total': 0.0
        }
        
        text_lower = text.lower()
        
        # Extract subtotal
        subtotal_match = re.search(ReceiptParser.SUBTOTAL_PATTERN, text_lower)
        if subtotal_match:
            totals['subtotal'] = ReceiptParser.normalize_number(subtotal_match.group(2))
        
        # Extract tax (multiple patterns)
        for pattern in [
            r'(?:pajak|tax|ppn|pph)[\s:]+([\d.,]+)',
            r'([\d.,]+)\s*(?:%|persen)?\s*pajak'
        ]:
            tax_match = re.search(pattern, text_lower)
            if tax_match:
                value = ReceiptParser.normalize_number(tax_match.group(1))
                if value > 0 and value < 100:  # Likely percentage
                    # Calculate tax from subtotal
                    if totals['subtotal'] > 0:
                        totals['tax'] = (totals['subtotal'] * value) / 100
                else:
                    totals['tax'] = value
                break
        
        # Extract service charge
        service_match = re.search(r'(?:service|svc|layanan)[\s:]+([\d.,]+)', text_lower)
        if service_match:
            totals['service_charge'] = ReceiptParser.normalize_number(service_match.group(1))
        
        # Extract total/grand total
        total_match = re.search(ReceiptParser.TOTAL_PATTERN, text_lower)
        if total_match:
            totals['total'] = ReceiptParser.normalize_number(total_match.group(2))
        else:
            # Calculate from subtotal
            totals['total'] = totals['subtotal'] + totals['tax'] + totals['service_charge']
        
        return totals
    
    @classmethod
    def parse_receipt(cls, ocr_text: str) -> Dict[str, Any]:
        """
        PRODUCTION-GRADE RECEIPT PARSING
        Parse OCR text and return structured receipt data with confidence scoring.
        
        Returns:
        {
            'currency': 'USD',
            'items': [{'name': 'Item', 'quantity': 1, 'price': 10000}],
            'subtotal': 10000,
            'tax': 1000,
            'service_charge': 0,
            'total': 11000,
            'confidence': 0.95,
            'quality_metrics': {
                'item_count': 10,
                'has_total': True,
                'has_tax': True,
                'price_consistency': 0.98,
                'data_completeness': 0.95
            }
        }
        """
        # Debug: Save extracted OCR text to file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        debug_file = os.path.join(DEBUG_DIR, f"ocr_text_{timestamp}.txt")
        try:
            with open(debug_file, 'w', encoding='utf-8') as f:
                f.write(ocr_text)
            logger.info(f"OCR text saved: {debug_file}")
        except Exception as e:
            logger.warning(f"Failed to save OCR text: {e}")
        
        # Debug output
        logger.info(f"\n=== OCR TEXT ({len(ocr_text)} chars) ===")
        logger.info(ocr_text[:1500])
        logger.info("=" * 60)
        
        # === PARSE ITEMS ===
        items = cls.extract_items(ocr_text)
        items = cls._sanitize_items(items)
        logger.info(f"Items extracted: {len(items)}")
        for idx, item in enumerate(items, 1):
            logger.info(f"  {idx}. {item['name']} - {item['quantity']}x {item['price']} = {item['subtotal']}")
        
        # === EXTRACT TOTALS ===
        currency = cls.extract_currency(ocr_text)
        totals = cls.extract_totals(ocr_text)
        
        # === CONFIDENCE SCORING ===
        confidence_metrics = cls._calculate_confidence(
            items=items,
            totals=totals,
            ocr_text=ocr_text
        )

        # Fallback totals for receipts without explicit subtotal/total labels.
        if totals['subtotal'] <= 0 and items:
            totals['subtotal'] = float(sum(item.get('subtotal', 0.0) for item in items))
        if totals['total'] <= 0:
            totals['total'] = totals['subtotal'] + totals['tax'] + totals['service_charge']
        
        result = {
            'currency': currency,
            'items': items,
            'subtotal': totals['subtotal'],
            'tax': totals['tax'],
            'service_charge': totals['service_charge'],
            'total': totals['total'],
            'confidence': confidence_metrics['overall'],
            'quality_metrics': {
                'item_count': len(items),
                'has_total': totals['total'] > 0,
                'has_tax': totals['tax'] > 0,
                'price_consistency': confidence_metrics['price_consistency'],
                'data_completeness': confidence_metrics['completeness']
            }
        }
        
        logger.info(f"\n=== PARSING RESULT ===")
        logger.info(f"Currency: {currency}")
        logger.info(f"Items: {len(items)}")
        logger.info(f"Subtotal: {totals['subtotal']}")
        logger.info(f"Tax: {totals['tax']}")
        logger.info(f"Total: {totals['total']}")
        logger.info(f"Confidence: {confidence_metrics['overall']:.1%}")
        logger.info(f"=======================\n")
        
        return result
    
    @staticmethod
    def _calculate_confidence(items: List[Dict], totals: Dict, ocr_text: str) -> Dict[str, float]:
        """
        Calculate detailed confidence metrics for OCR result.
        Production-quality confidence scoring.
        """
        confidence = {
            'overall': 0.5,
            'price_consistency': 0.0,
            'completeness': 0.0,
            'item_quality': 0.0
        }
        
        # === ITEM QUALITY CHECK ===
        if len(items) > 0:
            # Check if we have reasonable item names
            name_quality = sum(1 for item in items if len(item['name']) >= 3) / max(len(items), 1)
            confidence['item_quality'] = name_quality
            confidence['overall'] += 0.15 * name_quality
        
        # === PRICE CONSISTENCY ===
        if len(items) > 1:
            prices = [item['price'] for item in items]
            # Check if prices are in reasonable range (not too extreme outliers)
            avg_price = np.mean(prices) if prices else 0
            if avg_price > 0:
                # Calculate coefficient of variation
                std_price = np.std(prices) if len(prices) > 1 else 0
                cv = std_price / avg_price if avg_price > 0 else 0
                # CV between 0-2 is normal, penalize extreme variations
                consistency = max(0, 1 - min(cv / 3, 1))
                confidence['price_consistency'] = consistency
                confidence['overall'] += 0.15 * consistency

            positive_prices = [p for p in prices if p > 0]
            if len(positive_prices) >= 2:
                skew_ratio = max(positive_prices) / max(min(positive_prices), 1)
                # Penalize extreme skew typical of OCR merged-digit failure.
                if skew_ratio > 120:
                    confidence['overall'] = max(0.0, confidence['overall'] - 0.20)
                elif skew_ratio > 60:
                    confidence['overall'] = max(0.0, confidence['overall'] - 0.10)
        else:
            confidence['price_consistency'] = 0.5
        
        # === DATA COMPLETENESS ===
        completeness = 0.0
        if len(items) > 0:
            completeness += 0.25  # Has items
        if totals['subtotal'] > 0:
            completeness += 0.25  # Has subtotal  
        if totals['total'] > 0:
            completeness += 0.25  # Has total
        if totals['tax'] > 0:
            completeness += 0.15  # Has tax
        
        confidence['completeness'] = min(completeness, 1.0)
        confidence['overall'] += 0.35 * confidence['completeness']
        
        # === TOTAL VALIDATION ===
        if len(items) > 0 and totals['subtotal'] == 0:
            # If we have items but no subtotal, calculate it
            calculated_subtotal = sum(item['subtotal'] for item in items)
            if calculated_subtotal > 0:
                totals['subtotal'] = calculated_subtotal
                confidence['overall'] += 0.10
        
        # === FINAL CONFIDENCE ===
        # Boost if we have good data
        if len(items) >= 5 and totals['total'] > 0:
            confidence['overall'] = min(0.95, confidence['overall'] + 0.15)
        elif len(items) >= 3 and totals['total'] > 0:
            confidence['overall'] = min(0.90, confidence['overall'] + 0.10)
        
        # Cap at reasonable maximum
        confidence['overall'] = min(max(confidence['overall'], 0.0), 0.95)
        
        return confidence


class OCREngine:
    """Handle OCR using Tesseract with advanced preprocessing and multi-pass extraction."""
    
    # OCR Error correction dictionary (Indonesian + English common misreads)
    OCR_CORRECTIONS = {
        # Currency symbol errors
        'rpi': 'Rp',
        'rpo': 'Rp',
        'kp': 'Rp',
        'kpo': 'Rp',
        'rnl': 'Rp',
        'kpi': 'Rp',
        
        # Common Indonesian words
        'indomii': 'indomie',
        'indeemic': 'indomie',
        'inJomie': 'indomie',
        'indomi': 'indomie',
        'domie': 'indomie',
        'telor': 'telur',
        'telur': 'telur',
        'ayam': 'ayam',
        'ayan': 'ayam',
        'kambing': 'kambing',
        'sapi': 'sapi',
        'teas': 'teh',
        'teh': 'teh',
        'kopi': 'kopi',
        'kopl': 'kopi',
        'kop1': 'kopi',
        'minuman': 'minuman',
        'air': 'air',
        'nasi': 'nasi',
        'roti': 'roti',
        'mie': 'mie',
        'gorengan': 'gorengan',
        'goreng': 'goreng',
        'bakar': 'bakar',
        'asap': 'asap',
    }
    
    @staticmethod
    def _estimate_photo_quality(image: Image.Image) -> Dict[str, float]:
        """Estimate simple photo quality metrics useful for OCR diagnostics."""
        grayscale = ImageOps.grayscale(image)
        contrast = float(ImageStat.Stat(grayscale).stddev[0])

        # Edge variance is a lightweight proxy for sharpness/blur.
        edges = grayscale.filter(ImageFilter.FIND_EDGES)
        sharpness = float(ImageStat.Stat(edges).var[0])

        return {
            'contrast': contrast,
            'sharpness': sharpness,
        }

    @staticmethod
    def _prepare_photo_image(image: Image.Image) -> Image.Image:
        """Normalize orientation for phone photos and convert to RGB."""
        oriented = ImageOps.exif_transpose(image)
        return oriented.convert('RGB')

    @staticmethod
    def _preprocess_image(image: Image.Image) -> Image.Image:
        """Preprocess receipt image: resize -> grayscale -> threshold."""
        image = OCREngine._prepare_photo_image(image)
        width, height = image.size
        logger.info(f"Original size: {width}x{height}")

        # Bound image size for better OCR quality and memory safety.
        if width > 2400:
            scale = 2400 / width
            image = image.resize((int(width * scale), int(height * scale)), Image.Resampling.LANCZOS)
            logger.info(f"Downscaled to: {image.size[0]}x{image.size[1]}")
        elif width < 1200:
            scale = min(1200 / max(width, 1), 2.0)
            image = image.resize((int(width * scale), int(height * scale)), Image.Resampling.LANCZOS)
            logger.info(f"Upscaled to: {image.size[0]}x{image.size[1]}")

        grayscale = ImageOps.grayscale(image)
        denoised = grayscale.filter(ImageFilter.MedianFilter(size=3))
        contrast = ImageEnhance.Contrast(denoised).enhance(1.35)
        sharpened = ImageEnhance.Sharpness(contrast).enhance(1.25)
        normalized = ImageOps.autocontrast(sharpened)

        pixels = np.asarray(normalized, dtype=np.uint8)
        threshold_value = int(np.mean(pixels))
        binary = normalized.point(lambda p: 255 if p > threshold_value else 0)
        logger.info(f"Preprocessing complete with threshold={threshold_value}")

        return binary

    @staticmethod
    def _build_ocr_variants(image: Image.Image) -> List[Image.Image]:
        """Build a small set of image variants to improve OCR robustness."""
        base = OCREngine._prepare_photo_image(image)
        primary = OCREngine._preprocess_image(base)

        grayscale = ImageOps.grayscale(base)
        contrast = ImageEnhance.Contrast(grayscale).enhance(1.45)
        sharp = ImageEnhance.Sharpness(contrast).enhance(1.35)
        alt = ImageOps.autocontrast(sharp)

        # Strong variant for low-contrast phone photos.
        boosted = ImageEnhance.Contrast(grayscale).enhance(1.8)
        boosted = ImageEnhance.Sharpness(boosted).enhance(1.5)
        boosted = ImageOps.autocontrast(boosted)

        # Binary variant with aggressive thresholding for faded receipts.
        boosted_arr = np.asarray(boosted, dtype=np.uint8)
        p75 = int(np.percentile(boosted_arr, 75))
        aggressive_binary = boosted.point(lambda p: 255 if p > p75 else 0)

        return [primary, alt, boosted, aggressive_binary]

    @staticmethod
    def _score_candidate_text(text: str) -> float:
        """Score OCR candidate text by receipt-likeness (items + totals + useful length)."""
        if not text or not text.strip():
            return 0.0

        items = ReceiptParser.extract_items(text)
        totals = ReceiptParser.extract_totals(text)

        score = 0.0
        item_count = len(items)

        if item_count > 0:
            score += min(item_count / 8.0, 1.0) * 0.55

        if totals.get('subtotal', 0) > 0:
            score += 0.15
        if totals.get('total', 0) > 0:
            score += 0.20

        # Very short outputs are usually poor OCR captures.
        if len(text.strip()) > 80:
            score += 0.10

        return min(score, 1.0)

    @staticmethod
    def _extract_with_config(image: Image.Image, config: str) -> str:
        return pytesseract.image_to_string(
            image,
            lang='ind+eng',
            config=config,
        )
    
    @staticmethod
    def _correct_ocr_text(text: str) -> str:
        """
        POST-OCR CORRECTION - Fix common Tesseract misreads
        Uses dictionary and pattern-based correction
        """
        corrected = text
        
        # Fix currency symbols comprehensively
        # Pattern: any word that looks like "Rp" but isn't
        corrected = re.sub(r'\b(?:rpi|rpo|kp|kpo|kpi|Kp|KPi|RPI|RPO)\b', 'Rp', corrected, flags=re.IGNORECASE)
        
        # Fix common Indonesian menu items
        for wrong, right in OCREngine.OCR_CORRECTIONS.items():
            # Use word boundaries to avoid partial replacements
            pattern = r'\b' + re.escape(wrong) + r'\b'
            corrected = re.sub(pattern, right, corrected, flags=re.IGNORECASE)
        
        # Fix spacing issues around Rp symbol
        corrected = re.sub(r'Rp\s+(\d)', r'Rp\1', corrected)  # "Rp 25000" -> "Rp25000"
        corrected = re.sub(r'(\d)\s+Rp', r'\1Rp', corrected)   # "25000 Rp" -> "25000Rp"
        
        # Fix common spacing issues in numbers
        corrected = re.sub(r'(\d+)\s+(\d{3})(?:\s|$)', r'\1\2', corrected)  # "25 000" -> "25000"
        
        return corrected
    
    @staticmethod
    def extract_text_from_image(image_bytes: bytes) -> str:
        """
        SIMPLE OCR EXTRACTION - Focus on quality over complexity
        
        Process:
        1. Safe dependency check + image validation
        2. Image preprocessing (resize -> grayscale -> threshold)
        3. OCR extraction + post correction
        """
        try:
            logger.info("=== OCR EXTRACTION START ===")
            status = get_ocr_runtime_status()
            provider_mode = status.get("provider", "auto")
            google_available = bool((status.get("google_vision") or {}).get("available"))
            tesseract_available = bool((status.get("tesseract") or {}).get("available"))

            if not status.get("available"):
                raise OCRError("No OCR provider available")
            
            with Image.open(io.BytesIO(image_bytes)) as source_image:
                source_image.load()
                image = source_image.copy()

            logger.info(f"Original image: {image.size} {image.format}")
            quality = OCREngine._estimate_photo_quality(image)
            logger.info(f"Photo quality: contrast={quality['contrast']:.1f}, sharpness={quality['sharpness']:.1f}")
            
            best_text = ""
            best_score = -1.0

            # 1) Cloud OCR candidate (high-accuracy path)
            if provider_mode in ("auto", "google_vision") and google_available:
                try:
                    cloud_text = extract_text_google_vision(image_bytes)
                    if cloud_text:
                        corrected = OCREngine._correct_ocr_text(cloud_text)
                        score = OCREngine._score_candidate_text(corrected)
                        logger.info(f"OCR candidate source='google_vision' score={score:.3f} chars={len(corrected)}")
                        if score > best_score:
                            best_score = score
                            best_text = corrected
                except Exception as cloud_error:
                    logger.warning(f"Google Vision OCR failed: {cloud_error}")
                    if provider_mode == "google_vision" and not tesseract_available:
                        raise OCRError(f"Google Vision OCR failed: {cloud_error}")

            # 2) Local Tesseract candidates (fallback and/or parallel scorer)
            run_tesseract = provider_mode in ("auto", "tesseract") and tesseract_available
            if run_tesseract:
                variants = OCREngine._build_ocr_variants(image)
                logger.info(f"Prepared {len(variants)} OCR variants")

                ocr_configs = [
                    '--oem 1 --psm 6',
                    '--oem 1 --psm 4',
                    '--oem 1 --psm 11',
                ]

                for variant_idx, variant in enumerate(variants, start=1):
                    logger.info(f"OCR variant {variant_idx}: size={variant.size}")
                    for cfg in ocr_configs:
                        raw_text = OCREngine._extract_with_config(variant, cfg)
                        if not raw_text or not raw_text.strip():
                            continue

                        corrected = OCREngine._correct_ocr_text(raw_text)
                        score = OCREngine._score_candidate_text(corrected)
                        logger.info(f"OCR candidate source='tesseract' cfg='{cfg}' score={score:.3f} chars={len(corrected)}")

                        if score > best_score:
                            best_score = score
                            best_text = corrected

            text = best_text
            logger.info(f"Selected best OCR candidate score={best_score:.3f}, chars={len(text)}")

            if not text or not text.strip():
                raise OCRError("OCR returned empty text")
            
            logger.info(f"=== OCR EXTRACTION COMPLETE: {len(text)} chars ===")
            return text
            
        except pytesseract.TesseractNotFoundError:
            raise OCRError("Tesseract OCR not installed")
        except OCRError:
            raise
        except Exception as e:
            logger.error(f"OCR extraction failed: {e}", exc_info=True)
            raise OCRError(f"Failed to extract text from image: {str(e)}")


class OCRError(Exception):
    """OCR processing error."""
    pass
