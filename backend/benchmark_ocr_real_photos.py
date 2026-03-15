import argparse
import json
from datetime import datetime
from pathlib import Path

from receipt_processor import OCREngine, ReceiptParser

SUPPORTED_EXTS = {".jpg", ".jpeg", ".png"}


def evaluate_result(parsed: dict, min_confidence: float) -> tuple[bool, str]:
    items = parsed.get("items", [])
    total = float(parsed.get("total", 0.0) or 0.0)
    confidence = float(parsed.get("confidence", 0.0) or 0.0)

    if len(items) == 0:
        return False, "no_items"
    if total <= 0:
        return False, "invalid_total"
    if confidence < min_confidence:
        return False, "low_confidence"

    return True, "pass"


def run_benchmark(dataset_dir: Path, min_confidence: float) -> dict:
    image_paths = sorted(
        [p for p in dataset_dir.rglob("*") if p.is_file() and p.suffix.lower() in SUPPORTED_EXTS]
    )

    results = []
    for img_path in image_paths:
        record = {
            "file": str(img_path),
            "status": "fail",
            "reason": "unknown",
            "items": 0,
            "total": 0.0,
            "confidence": 0.0,
        }

        try:
            image_bytes = img_path.read_bytes()
            text = OCREngine.extract_text_from_image(image_bytes)
            parsed = ReceiptParser.parse_receipt(text)

            passed, reason = evaluate_result(parsed, min_confidence)
            record.update(
                {
                    "status": "pass" if passed else "fail",
                    "reason": reason,
                    "items": len(parsed.get("items", [])),
                    "total": float(parsed.get("total", 0.0) or 0.0),
                    "confidence": float(parsed.get("confidence", 0.0) or 0.0),
                }
            )
        except Exception as exc:
            record["reason"] = f"exception:{type(exc).__name__}"

        results.append(record)

    total_count = len(results)
    pass_count = sum(1 for r in results if r["status"] == "pass")
    pass_rate = (pass_count / total_count * 100.0) if total_count else 0.0

    reason_breakdown = {}
    for row in results:
        reason_breakdown[row["reason"]] = reason_breakdown.get(row["reason"], 0) + 1

    return {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "dataset_dir": str(dataset_dir),
        "thresholds": {
            "min_confidence": min_confidence,
        },
        "summary": {
            "total_images": total_count,
            "pass_images": pass_count,
            "fail_images": total_count - pass_count,
            "pass_rate_percent": round(pass_rate, 2),
            "target_pass_rate_percent": 95.0,
            "target_met": pass_rate >= 95.0,
            "reason_breakdown": reason_breakdown,
        },
        "results": results,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Benchmark OCR quality on real receipt photos")
    parser.add_argument("--dataset", required=True, help="Directory containing receipt photos")
    parser.add_argument("--min-confidence", type=float, default=0.60, help="Minimum confidence for pass")
    parser.add_argument("--output", required=True, help="Output JSON file path")
    args = parser.parse_args()

    dataset_dir = Path(args.dataset).resolve()
    output_path = Path(args.output).resolve()

    if not dataset_dir.exists() or not dataset_dir.is_dir():
        raise SystemExit(f"Dataset directory not found: {dataset_dir}")

    report = run_benchmark(dataset_dir, args.min_confidence)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    summary = report["summary"]
    print("OCR Benchmark Summary")
    print(f"- Dataset: {report['dataset_dir']}")
    print(f"- Total images: {summary['total_images']}")
    print(f"- Pass images: {summary['pass_images']}")
    print(f"- Fail images: {summary['fail_images']}")
    print(f"- Pass rate: {summary['pass_rate_percent']}%")
    print(f"- Target 95% met: {summary['target_met']}")
    print(f"- Output: {output_path}")


if __name__ == "__main__":
    main()
