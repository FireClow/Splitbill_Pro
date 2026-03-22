# Splitbill_Pro - OCR Receipt Processing System

## Overview
Advanced OCR-based receipt processing system with simplified preprocessing pipeline optimized for Indonesian receipts.

## Current Implementation
- **OCR Engine:** Hybrid OCR (Google Vision + Tesseract fallback)
- **Image Processing:** Photo-oriented enhancement pipeline (EXIF orientation + multi-variant preprocessing)
- **Extraction:** Multi-candidate OCR selection with post-correction and outlier filtering
- **Confidence Scoring:** 5-metric quality evaluation system
- **Status:** Production-ready, user-approved

## Setup
See deployment guide for full instructions.

## Android Release Preflight
Run one command before production build/submission to catch common release blockers:

```powershell
./scripts/release-preflight.ps1
```

What it validates:
- Frontend release env variables (`EXPO_PUBLIC_BACKEND_URL`, `EXPO_PUBLIC_PRIVACY_POLICY_URL`, `EXPO_PUBLIC_TERMS_URL`)
- Frontend lint
- Local backend health endpoint (`http://127.0.0.1:8000/api/health`)

Optional flags:

```powershell
./scripts/release-preflight.ps1 -SkipLint
./scripts/release-preflight.ps1 -SkipRuntimeChecks
```

## OCR For Real Receipt Photos (Recommended)
For real phone-camera receipt photos, use hybrid OCR mode:

1. Copy [backend/.env.example](backend/.env.example) to `.env` in backend folder.
2. Set `OCR_PROVIDER=auto`.
3. Fill `GOOGLE_VISION_API_KEY` for best accuracy.
4. Keep Tesseract installed as local fallback.

This setup gives higher practical accuracy on noisy photos while keeping local fail-safe support.
