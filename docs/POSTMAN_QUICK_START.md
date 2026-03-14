# Postman Quick Start - SplitBill

## Files
- Collection: `docs/SplitBill_API_Postman_Collection.json`
- Environment: `docs/SplitBill_Postman_Environment.json`

## Import Steps
1. Open Postman.
2. Import collection file.
3. Import environment file.
4. Select environment **SplitBill Local QA**.

## Pre-Run Checklist
1. Backend server running on `http://127.0.0.1:8001`.
2. Endpoint `GET /api/health` returns `status: ok`.

## How to Get Token
1. Run request: **Auth Session**.
2. Copy `session_token` from response body.
3. Paste into environment variable `token`.

## Recommended Run Order
1. `Health`
2. `Auth Session`
3. `Create Bill - Valid per_item`
4. `Get Bills`
5. `Get Bill Detail`
6. `Update Item - Invalid Under Assignment`
7. `Create Bill - Invalid Assignment Overflow`

## Variable Update Steps
After successful bill creation:
1. Copy `bill_id` from response.
2. Set environment variable `billId`.
3. Open `Get Bill Detail` response and copy first `item_id`.
4. Set environment variable `itemId`.

## Expected Status Codes
- Valid create bill: `200`
- Get bills/detail: `200`
- Invalid assignment overflow: `400`
- Invalid update assignment: `400`
- Missing required field on create: `422`

## Troubleshooting
- `401 Unauthorized`: token not set/expired. Run Auth Session again.
- `404 Bill not found`: ensure `billId` is set from latest create response.
- Connection error: verify backend server and `baseUrl` value.
