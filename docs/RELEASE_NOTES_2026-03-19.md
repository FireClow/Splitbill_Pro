# SplitBill Release Notes - 2026-03-19

## Summary
This release finalizes OCR parsing hardening, scanner-style manual crop stability, and participant consistency during bill creation.

## Included Commits
- c2c9018 - ocr: harden item filtering and stabilize manual crop priority
- 4296fab - frontend: add 4-point cropper and bill participant dedupe UX
- 2e0165a - backend: harden OCR crop flow and participant handling

## What Changed

### OCR Parsing Quality
- Added stronger post-OCR filtering to exclude payment and transaction noise.
- Excluded payment/system keywords such as QRIS, cash, debit, credit, total/subtotal, paid, change, and kembalian from item parsing.
- Added explicit date/time pattern exclusion.
- Added transaction metadata exclusion for lines such as transaction/invoice/order info.
- Added stop-after-total behavior to avoid parsing footer/payment sections as items.
- Added additional item-name sanity checks to drop OCR garbage tokens.

### Manual Crop Behavior
- Manual 4-corner crop remains primary after user interaction.
- Added one-shot auto-crop suggestion behavior for initial state only.
- Prevented auto suggestion from overriding manual edits once user drags corners.
- Improved crop polygon stability across layout/image-frame changes.
- Added backend crop suggestion endpoint and safer geometry fallback behavior.

### Bill Participant Consistency
- Removed implicit owner auto-add behavior from bill creation.
- Added participant dedupe and assignment mapping hardening.
- Kept split calculations aligned with deduplicated participant set.

## Validation Status
- Backend full suite: 91 passed.
- OCR parser suite: passed.
- OCR endpoint validation suite: passed.
- Frontend lint: passed.
- Live scan sanity check: payment/date/metadata leakage removed from item output.

## Notable Impact
- Cleaner OCR item output for split calculations.
- Better manual control and reliability in crop-and-rescan flow.
- More predictable participant behavior in create-bill flow.
