# SplitBill QA Test Report (2026-03-14)

## 1. Objective
Validate SplitBill end-to-end for functional correctness, UI/API stability, assignment quantity logic, and production readiness.

## 2. Test Environment
- OS: Windows
- Backend URL: http://127.0.0.1:8001
- Frontend URL: http://localhost:8081 (also reachable on http://127.0.0.1:3000)
- Python env: backend/.venv311
- Frontend framework: Expo web

## 3. Automated Test Execution

### 3.1 Frontend Lint
Command:
- `npm run lint` (run from `frontend`)

Result:
- PASS
- Exit code: 0

### 3.2 Backend Full Regression
Command:
- `.venv311\\Scripts\\python.exe -m pytest -q` (run from `backend`)

Result:
- PASS
- 58 passed
- 0 functional warnings impacting test outcome

### 3.3 Assignment-Focused Backend Regression
Command:
- `.venv311\\Scripts\\python.exe -m pytest tests/test_02_bills_crud.py tests/test_03_items_management.py tests/test_05_splits_and_payments.py tests/test_10_item_assignment_logic.py tests/test_11_item_assignment_service.py -q`

Result:
- PASS
- 29 passed

### 3.4 API Error Handling Extension
New test file:
- `backend/tests/test_12_api_error_handling.py`

Command:
- `.venv311\\Scripts\\python.exe -m pytest tests/test_12_api_error_handling.py -q`

Result:
- PASS
- 5 passed

## 4. Runtime Smoke Test

### 4.1 Backend Health
Command:
- `Invoke-WebRequest http://127.0.0.1:8001/api/health`

Result:
- PASS
- Returned status payload: `ok`

### 4.2 Frontend Reachability
Commands:
- `Invoke-WebRequest http://localhost:8081`
- `Invoke-WebRequest http://127.0.0.1:3000`

Result:
- PASS
- HTTP 200 on both endpoints

## 5. Issues Detected and Fixed

### 5.1 Dead-End Clickable Element in Receipt Review
- Location: `frontend/app/review-receipt.tsx`
- Issue: crop corner handles were rendered as clickable `TouchableOpacity` without active drag handler.
- Risk: user sees interactive control with no action (dead-end UX).
- Fix: replaced crop handles with non-clickable `View` elements.
- Validation: frontend lint and errors check passed.

## 6. Assignment Logic Validation Summary
Validated:
- Quantity split formula: user cost = assigned qty * unit price
- Remaining quantity indicator behavior
- Save enable/disable behavior based on exact quantity matching
- Overflow and under-assignment rejections
- Invalid assignment payload rejects with 400/422 (not 500)
- Floating precision scenario (`0.1` and `0.2`) works in API path

## 7. API Behavior Summary
Validated endpoints:
- `POST /api/bills`
- `PUT /api/bills/{bill_id}/items/{item_id}`
- `GET /api/bills`
- `GET /api/bills/{bill_id}`

Outcome:
- Correct status codes for valid requests
- User input errors handled without internal server crash

## 8. Performance and Code Quality Notes
- Assignment normalization and clamping centralized in shared frontend utility.
- Memoized assignment mapping in bill detail flow to reduce repeated recalculation.
- Duplicate assignment parsing logic removed from split utility path.
- No frontend compile errors reported by workspace problem check.

## 9. Remaining Non-Blocking Technical Debt
- No blocking technical debt found in tested scope.
- FastAPI lifecycle has been migrated to lifespan handler.

## 10. Manual API Testing Asset
- Postman collection added:
	- `docs/SplitBill_API_Postman_Collection.json`
- Postman environment added:
	- `docs/SplitBill_Postman_Environment.json`
- Quick-start guide added:
	- `docs/POSTMAN_QUICK_START.md`
- Includes:
	- auth session bootstrap
	- health check
	- valid create bill per_item payload
	- invalid overflow payload
	- get list/detail
	- invalid update item assignment payload

## 11. Production Readiness Verdict
- Functional readiness: PASS
- API stability: PASS
- Assignment-critical flow: PASS
- UI dead-end audit (current known issues): PASS after fix
- Overall: Ready for UAT and pre-production release candidate
