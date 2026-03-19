# PR: Full Audit Hardening and Flow Validation (2026-03-19)

## Why
This PR closes a full-stack audit cycle and hardens critical security, flow reliability, OCR UX, and test determinism.

## Scope

### Backend
- Added centralized bill access guard logic to prevent unauthorized access.
- Enforced owner-only checks on sensitive bill mutation endpoints.
- Preserved HTTPException semantics in OCR confirm endpoint.
- Added regression tests for access control violations.

### Frontend
- Enforced bill name as required first step before OCR actions.
- Propagated bill title through scan -> review -> create flow.
- Hardened OCR review item sanitization (name/quantity/price).
- Removed dead scan result branch to simplify flow and reduce maintenance complexity.

### Scripts
- Fixed Windows frontend startup process in start-dev script by using npm.cmd.

### Tests
- Stabilized pytest integration runs with isolated backend URL and automatic uvicorn lifecycle in test fixture.
- Synced backend test fallback URLs for local consistency.
- Added new access-control test suite.

## Key Files Changed
- backend/server.py
- backend/tests/conftest.py
- backend/tests/test_16_bill_access_control.py
- frontend/app/scan-receipt.tsx
- frontend/app/review-receipt.tsx
- frontend/app/create-bill.tsx
- scripts/start-dev.ps1
- docs/RELEASE_NOTES_2026-03-19.md

## Security Impact
- Unauthorized users can no longer read or mutate foreign bills via API routes covered by new access checks.
- Share-link creation is now owner-restricted.

## Product Flow Validation

### OCR flow
1. Input bill name
2. Scan/upload receipt image
3. Review OCR result
4. Continue to assign participants/items in create flow
5. Final review and submit

### Manual flow
1. Input bill name
2. Add items manually
3. Add participants
4. Assign items
5. Review
6. Submit

## Validation Evidence
- Frontend lint: pass
- Backend syntax compile: pass
- Backend tests: 93 passed
- Runtime smoke: start-dev script healthy, backend health endpoint 200

## Breaking Changes
- None intended at API contract level.

## Risk Notes
- Access control logic was tightened: any consumer relying on permissive foreign-bill access will now receive 403.
- Test fixture now controls backend URL for deterministic local execution.

## Rollback Plan
- Revert this PR commit.
- Restore prior access checks in backend/server.py if emergency compatibility rollback is required.

## Manual QA Checklist
- Create bill manually end-to-end.
- Scan receipt with bill name and continue to review/create.
- Edit OCR items (add/edit/delete) and confirm receipt.
- Attempt foreign-bill access with another session token and verify 403.
- Generate share link as owner and verify success.
