"""
Unit tests for OCR processing pipeline and dependency checks.
"""

from io import BytesIO
import base64

import pytest
from PIL import Image

from ocr_service import decode_base64_image_data, get_tesseract_status, validate_receipt_upload
from receipt_processor import OCREngine, OCRError, ReceiptParser


def _sample_png_bytes(color=(255, 255, 255)):
    image = Image.new("RGB", (320, 180), color)
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def _sample_jpeg_bytes(color=(255, 255, 255)):
    image = Image.new("RGB", (320, 180), color)
    buffer = BytesIO()
    image.save(buffer, format="JPEG")
    return buffer.getvalue()


def test_ocr_engine_valid_image_pipeline(monkeypatch):
    monkeypatch.setattr(
        "receipt_processor.get_ocr_runtime_status",
        lambda: {
            "available": True,
            "provider": "tesseract",
            "google_vision": {"available": False},
            "tesseract": {"available": True},
        },
    )
    monkeypatch.setattr(
        "receipt_processor.pytesseract.image_to_string",
        lambda *_args, **_kwargs: "Burger 5.50\nFries 2.50\nDrink 1.50",
    )

    text = OCREngine.extract_text_from_image(_sample_png_bytes())
    assert "Burger" in text
    assert "Fries" in text


def test_ocr_engine_missing_tesseract_raises(monkeypatch):
    monkeypatch.setattr(
        "receipt_processor.get_ocr_runtime_status",
        lambda: {
            "available": False,
            "provider": "tesseract",
            "google_vision": {"available": False},
            "tesseract": {"available": False},
        },
    )

    with pytest.raises(OCRError, match="No OCR provider available"):
        OCREngine.extract_text_from_image(_sample_png_bytes())


def test_ocr_engine_empty_text_raises(monkeypatch):
    monkeypatch.setattr(
        "receipt_processor.get_ocr_runtime_status",
        lambda: {
            "available": True,
            "provider": "tesseract",
            "google_vision": {"available": False},
            "tesseract": {"available": True},
        },
    )
    monkeypatch.setattr("receipt_processor.pytesseract.image_to_string", lambda *_args, **_kwargs: "   ")

    with pytest.raises(OCRError, match="empty text"):
        OCREngine.extract_text_from_image(_sample_png_bytes())


def test_ocr_engine_invalid_image_bytes_raises(monkeypatch):
    monkeypatch.setattr(
        "receipt_processor.get_ocr_runtime_status",
        lambda: {
            "available": True,
            "provider": "tesseract",
            "google_vision": {"available": False},
            "tesseract": {"available": True},
        },
    )

    with pytest.raises(OCRError):
        OCREngine.extract_text_from_image(b"not-a-real-image")


def test_receipt_parser_simple_lines_to_items():
    parsed = ReceiptParser.parse_receipt("Burger 5.50\nFries 2.50\nDrink 1.50")

    assert len(parsed["items"]) == 3
    assert parsed["items"][0]["name"].lower() == "burger"
    assert parsed["items"][0]["price"] == 5.5
    assert parsed["subtotal"] == 9.5
    assert parsed["total"] == 9.5


def test_tesseract_status_missing_returns_install_instructions(monkeypatch):
    monkeypatch.setattr("ocr_service._detect_tesseract_cmd", lambda: None)

    def _raise(*_args, **_kwargs):
        raise RuntimeError("missing")

    monkeypatch.setattr("ocr_service.pytesseract.get_tesseract_version", _raise)

    status = get_tesseract_status()
    assert status["available"] is False
    assert "install_instructions" in status


def test_validate_receipt_upload_valid_jpeg_passes():
    fmt = validate_receipt_upload("receipt.jpg", "image/jpeg", _sample_jpeg_bytes())
    assert fmt == "JPEG"


def test_decode_base64_data_url_valid_image():
    encoded = base64.b64encode(_sample_png_bytes()).decode("utf-8")
    payload = f"data:image/png;base64,{encoded}"
    decoded = decode_base64_image_data(payload)
    assert decoded.startswith(b"\x89PNG")


def test_decode_base64_data_url_invalid_raises():
    with pytest.raises(ValueError, match="Invalid base64"):
        decode_base64_image_data("data:image/jpeg;base64,@@invalid@@")


def test_receipt_parser_indonesian_multi_line_quantity_format():
    text = "Indomie Bangladesh Jumbo\n3 x Rp25.000\nIndomie Bangladesh Spesial\n2 x Rp25.000"
    parsed = ReceiptParser.parse_receipt(text)

    assert len(parsed["items"]) == 2
    assert parsed["items"][0]["quantity"] == 3
    assert parsed["items"][0]["price"] == 25000.0
    assert parsed["items"][1]["quantity"] == 2
    assert parsed["items"][1]["price"] == 25000.0


def test_receipt_parser_filters_qris_payment_noise():
    text = (
        "Nasi Goreng\n"
        "1 x Rp18.000\n"
        "Es Teh Manis\n"
        "1 x Rp6.000\n"
        "QRIS BCA : Rp24.000\n"
        "Total Paid : Rp24.000\n"
    )
    parsed = ReceiptParser.parse_receipt(text)
    names = [item["name"].lower() for item in parsed["items"]]

    assert any("nasi goreng" in name for name in names)
    assert any("es teh manis" in name for name in names)
    assert all("qris" not in name for name in names)
    assert all("bca" not in name for name in names)
    assert all("paid" not in name for name in names)


def test_receipt_parser_filters_cash_change_lines():
    text = (
        "Mie Ayam\n"
        "1 x Rp12.000\n"
        "Air Mineral\n"
        "1 x Rp4.000\n"
        "Cash : Rp20.000\n"
        "Kembalian : Rp4.000\n"
    )
    parsed = ReceiptParser.parse_receipt(text)
    names = [item["name"].lower() for item in parsed["items"]]

    assert any("mie ayam" in name for name in names)
    assert any("air mineral" in name for name in names)
    assert all("cash" not in name for name in names)
    assert all("kembalian" not in name for name in names)


def test_receipt_parser_stops_after_total_section():
    text = (
        "Burger\n"
        "1 x Rp30.000\n"
        "French Fries\n"
        "1 x Rp15.000\n"
        "Grand Total : Rp45.000\n"
        "Debit BCA : Rp45.000\n"
        "Ice Cream\n"
        "1 x Rp10.000\n"
    )
    parsed = ReceiptParser.parse_receipt(text)
    names = [item["name"].lower() for item in parsed["items"]]

    assert any("burger" in name for name in names)
    assert any("french fries" in name for name in names)
    assert all("ice cream" not in name for name in names)


def test_receipt_parser_excludes_date_and_time_lines():
    text = (
        "18/02/2026 10:30:45\n"
        "Sate Ayam\n"
        "1 x Rp22.000\n"
        "18 Feb 2026\n"
        "Es Jeruk\n"
        "1 x Rp8.000\n"
        "10:31\n"
    )
    parsed = ReceiptParser.parse_receipt(text)
    names = [item["name"].lower() for item in parsed["items"]]

    assert any("sate ayam" in name for name in names)
    assert any("es jeruk" in name for name in names)
    assert all("2026" not in name for name in names)


def test_receipt_parser_excludes_transaction_metadata_lines():
    text = (
        "Transaction ID: TRX-8891\n"
        "Order No: A-17\n"
        "Nasi Campur\n"
        "1 x Rp25.000\n"
        "Invoice: INV-2026-001\n"
    )
    parsed = ReceiptParser.parse_receipt(text)
    names = [item["name"].lower() for item in parsed["items"]]

    assert names == ["nasi campur"]


def test_receipt_parser_detects_tax_and_service_keywords_with_amounts():
    text = (
        "Nasi Goreng\n"
        "1 x Rp20.000\n"
        "Es Teh\n"
        "1 x Rp5.000\n"
        "PPN : Rp2.500\n"
        "Service Charge : Rp1.000\n"
        "Total : Rp28.500\n"
    )
    parsed = ReceiptParser.parse_receipt(text)

    assert parsed["subtotal"] == 25000.0
    assert parsed["tax"] == 2500.0
    assert parsed["service_charge"] == 1000.0
    assert parsed["total"] == 28500.0


def test_receipt_parser_detects_pb1_percentage_tax():
    text = (
        "Mie Ayam\n"
        "1 x Rp18.000\n"
        "Es Jeruk\n"
        "1 x Rp7.000\n"
        "PB1 10%\n"
        "Total\n"
    )
    parsed = ReceiptParser.parse_receipt(text)

    assert parsed["subtotal"] == 25000.0
    assert parsed["tax"] == 2500.0
    assert parsed["total"] == 27500.0


def test_receipt_parser_handles_receipt_without_tax():
    text = (
        "Chicken Katsu\n"
        "1 x 45.00\n"
        "Iced Lemon Tea\n"
        "1 x 12.00\n"
    )
    parsed = ReceiptParser.parse_receipt(text)

    assert parsed["subtotal"] == 57.0
    assert parsed["tax"] == 0.0
    assert parsed["service_charge"] == 0.0
    assert parsed["total"] == 57.0


def test_receipt_parser_deduplicates_duplicate_items_and_ignores_qr_payment_noise():
    text = (
        "Nasi Uduk\n"
        "1 x Rp12.000\n"
        "Nasi Uduk\n"
        "1 x Rp12.000\n"
        "QRIS BCA : Rp24.000\n"
        "Tanggal 19/03/2026\n"
    )
    parsed = ReceiptParser.parse_receipt(text)

    assert len(parsed["items"]) == 1
    assert parsed["items"][0]["name"].lower() == "nasi uduk"
    assert parsed["items"][0]["quantity"] == 2
    assert parsed["subtotal"] == 24000.0


def test_receipt_parser_drops_tiny_idr_noise_items():
    text = (
        "Indoaie Banglades Jusbo\n"
        "3 x Rp2\n"
        "nasi telur MOJ\n"
        "1 x Rp18.000\n"
        "ampung 1/2 Mateng\n"
        "1 x Rp8.000\n"
        "teh Tawar Dingin\n"
        "5 x Rp7.000\n"
        "air Mineral\n"
        "1 x Rp5\n"
        "teh Tarik Dingin\n"
        "1 x Rp18.000\n"
    )
    parsed = ReceiptParser.parse_receipt(text)

    names = [item["name"].lower() for item in parsed["items"]]
    assert all("indoaie" not in name for name in names)
    assert all("air mineral" not in name for name in names)

    # Keep valid items and quantities.
    assert any("nasi telur moj" in name for name in names)
    assert any("ampung 1/2 mateng" in name for name in names)
    assert any("teh tawar dingin" in name for name in names)
    assert any("teh tarik dingin" in name for name in names)
    assert parsed["subtotal"] == 79000.0


def test_receipt_parser_maps_subtotal_tax_grand_total_correctly_with_noise():
    text = (
        "nasi telur MOJ\n"
        "1 x Rp18.000\n"
        "teh Tawar Dingin\n"
        "5 x Rp7.000\n"
        "Subtotal\n"
        "Rp263.000\n"
        "Total\n"
        "Rp263.000\n"
        "Pajak\n"
        "Rp26.300\n"
        "Grand Total : Rp289.300\n"
        "QRIS BHI\n"
        "Rp289.300\n"
        "Terima Kasih\n"
        "Whatsapp : +6281111807322\n"
    )

    parsed = ReceiptParser.parse_receipt(text)

    assert parsed["subtotal"] == 263000.0
    assert parsed["tax"] == 26300.0
    assert parsed["total"] == 289300.0
    assert parsed["quality_metrics"]["parsing_error"] is False


def test_receipt_parser_prioritizes_grand_total_over_total_label():
    text = (
        "Subtotal : Rp100.000\n"
        "Tax : Rp10.000\n"
        "Total : Rp100.000\n"
        "Grand Total : Rp110.000\n"
    )

    parsed = ReceiptParser.parse_receipt(text)

    assert parsed["subtotal"] == 100000.0
    assert parsed["tax"] == 10000.0
    assert parsed["total"] == 110000.0


def test_receipt_parser_handles_sudtotal_typo_and_oris_paid_total():
    text = (
        "Sudtotal : Rp263.000\n"
        "Total : Rp263.000\n"
        "Pajak : Rp26.300\n"
        "ORIS BHI : Rp289.300\n"
    )

    parsed = ReceiptParser.parse_receipt(text)

    assert parsed["subtotal"] == 263000.0
    assert parsed["tax"] == 26300.0
    assert parsed["total"] == 289300.0
    assert parsed["quality_metrics"]["parsing_error"] is False


def test_receipt_parser_flags_and_recovers_severe_total_mismatch_after_subtotal_fallback():
    text = (
        "Indomie Banglades Jumbo\n"
        "3 x Rp25.000\n"
        "Indomie Banglades Spesial\n"
        "2 x Rp25.000\n"
        "Pajak: Rp26.30\n"
        "Total: 578.60\n"
        "Bill | #1 | #2 | #3\n"
    )

    parsed = ReceiptParser.parse_receipt(text)

    assert parsed["subtotal"] == 125000.0
    assert parsed["tax"] == 26.3
    assert parsed["total"] == 125026.3
    assert parsed["quality_metrics"]["parsing_error"] is True


def test_receipt_parser_marks_ambiguous_idr_tiny_tax_from_decimal_artifact():
    text = (
        "Nasi Goreng\n"
        "2 x Rp25.000\n"
        "Subtotal : Rp50.000\n"
        "Pajak: Rp26.30\n"
        "Total : Rp50.026\n"
    )

    parsed = ReceiptParser.parse_receipt(text)

    assert parsed["subtotal"] == 50000.0
    assert parsed["tax"] == 26.3
    assert parsed["quality_metrics"]["tax_ambiguous"] is True
    assert parsed["quality_metrics"]["parsing_error"] is True
