# SplitBill UAT Checklist (Manual) - 2026-03-14

## Instructions
- Mark each row as PASS / FAIL.
- Add evidence notes (screenshot/video/request payload) in the Notes column.
- If FAIL, include reproduction steps and observed behavior.
- API tools reference:
  - Collection: `docs/SplitBill_API_Postman_Collection.json`
  - Environment: `docs/SplitBill_Postman_Environment.json`
  - Guide: `docs/POSTMAN_QUICK_START.md`

## A. Environment Setup
| ID | Step | Expected Result | Status | Notes |
|---|---|---|---|---|
| A1 | Start backend on port 8001 | `/api/health` returns status `ok` |  |  |
| A2 | Start frontend web | App loads in browser without crash |  |  |
| A3 | Open browser console | No blocking runtime errors on initial load |  |  |

## B. Navigation and Button Coverage
| ID | Step | Expected Result | Status | Notes |
|---|---|---|---|---|
| B1 | Home -> Create Bill | Navigates to create flow |  |  |
| B2 | Home -> Scan Receipt | Navigates to scan flow |  |  |
| B3 | Home -> View All Bills | Navigates to bills tab/list |  |  |
| B4 | Bills list item click | Opens bill detail page |  |  |
| B5 | Bill detail back button | Returns to previous page |  |  |
| B6 | Create Bill close button | Returns/back without freeze |  |  |
| B7 | All visible action buttons | Every button performs meaningful action |  |  |

## C. Create Bill Wizard (Details -> Items -> People -> Assign -> Review)
| ID | Step | Expected Result | Status | Notes |
|---|---|---|---|---|
| C1 | Fill Details with valid title | Next enabled |  |  |
| C2 | Empty title then next | Validation shown, cannot proceed |  |  |
| C3 | Add 2-3 items | Items appear correctly |  |  |
| C4 | Remove one item | Item removed, state remains stable |  |  |
| C5 | Add participants | Participants appear correctly |  |  |
| C6 | Remove participant | Participant removed and assignment cleaned |  |  |
| C7 | Assign step partial quantities | Next blocked, warning shown |  |  |
| C8 | Assign step exact quantities | Next enabled |  |  |
| C9 | Back button across steps | Previous state preserved correctly |  |  |
| C10 | Review step create bill | Bill created and redirects to detail |  |  |

## D. Assignment Logic Validation (Critical)
Use sample:
- Item price = 6
- Item quantity = 3
- User1 qty = 2
- User2 qty = 1

| ID | Step | Expected Result | Status | Notes |
|---|---|---|---|---|
| D1 | Enter sample assignment | Remaining qty becomes 0 |  |  |
| D2 | Save assignment | Save allowed only when total qty = item qty |  |  |
| D3 | Verify split output | User1 owes 4, User2 owes 2 |  |  |
| D4 | Try overflow qty (e.g. 4) | Clamped/rejected with warning |  |  |
| D5 | Try under-assignment | Save blocked with validation message |  |  |

## E. Bill Detail Operations
| ID | Step | Expected Result | Status | Notes |
|---|---|---|---|---|
| E1 | Add new item in bill detail | Item added and totals recalc |  |  |
| E2 | Delete item | Item removed and totals recalc |  |  |
| E3 | Add participant | Participant added and split updates |  |  |
| E4 | Remove participant | Participant removed and assignments updated |  |  |
| E5 | Change split method equal/per_item | Split recalculates correctly |  |  |
| E6 | Toggle paid/unpaid | Payment state updates correctly |  |  |
| E7 | Delete bill | Bill removed and redirect works |  |  |

## F. Scan Receipt and Review Flow
| ID | Step | Expected Result | Status | Notes |
|---|---|---|---|---|
| F1 | Open scan page camera mode | Camera UI opens or permission prompt shown |  |  |
| F2 | Pick image from gallery | OCR upload starts and result page opens |  |  |
| F3 | Review parsed items | Editable list behaves correctly |  |  |
| F4 | Save reviewed receipt to create bill | Redirect to create flow with item data |  |  |

## G. Negative and Edge Cases
| ID | Step | Expected Result | Status | Notes |
|---|---|---|---|---|
| G1 | Input invalid price text | Validation prevents invalid submit |  |  |
| G2 | Very large quantity input | UI stays responsive; validation works |  |  |
| G3 | Negative quantity attempt | Rejected or normalized safely |  |  |
| G4 | Missing required field submit | Error shown; no crash |  |  |
| G5 | Reopen modals repeatedly | Open/close works without stuck state |  |  |
| G6 | Refresh while on deep page | Route/state handles safely |  |  |

## H. API Spot Checks (Manual via Swagger/Postman)
| ID | Endpoint | Scenario | Expected | Status | Notes |
|---|---|---|---|---|---|
| H1 | POST /api/bills | Valid payload | 200 |  |  |
| H2 | POST /api/bills | Missing required field | 422 |  |  |
| H3 | POST /api/bills | Invalid assignment overflow | 400 |  |  |
| H4 | PUT /api/bills/{bill_id}/items/{item_id} | Invalid assignment | 400 |  |  |
| H5 | GET /api/bills | Fetch list | 200 |  |  |
| H6 | GET /api/bills/{bill_id} | Fetch detail | 200 |  |  |
| H7 | Any user input error | Internal server response | Not 500 |  |  |

## I. Sign-Off
- QA Engineer: __________________
- Date: __________________
- Final Decision (PASS / CONDITIONAL / FAIL): __________________
- Release Notes / Blocking Defects:
  - 
  - 
  - 
