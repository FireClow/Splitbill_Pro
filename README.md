# Splitbill_Pro - OCR Receipt Processing System

## Overview
Advanced OCR-based receipt processing system with simplified preprocessing pipeline optimized for Indonesian receipts.

## Current Implementation
- **OCR Engine:** Hybrid OCR (Google Vision + Tesseract fallback)
- **Image Processing:** Photo-oriented enhancement pipeline (EXIF orientation + multi-variant preprocessing)
- **Extraction:** Multi-candidate OCR selection with post-correction and outlier filtering
- **Confidence Scoring:** 5-metric quality evaluation system
- **Status:** Production-ready, user-approved

## Architecture
- **Frontend:** Expo React Native app in `frontend/`
- **Backend:** FastAPI service in `backend/`
- **Database:** MongoDB

## Setup
See deployment guide for full instructions.

## Canonical Runtime Target
- Primary implementation for active development is `frontend/` + `backend/` (Expo + FastAPI + MongoDB).
- Deprecated MVP (`patungin-mvp`) has been removed to maintain a single source of truth.

## OCR For Real Receipt Photos (Recommended)
For real phone-camera receipt photos, use hybrid OCR mode:

1. Copy [backend/.env.example](backend/.env.example) to `.env` in backend folder.
2. Set `OCR_PROVIDER=auto`.
3. Fill `GOOGLE_VISION_API_KEY` for best accuracy.
4. Keep Tesseract installed as local fallback.

This setup gives higher practical accuracy on noisy photos while keeping local fail-safe support.
