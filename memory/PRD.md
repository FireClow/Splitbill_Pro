# SplitBill Pro - Product Requirements Document

## Overview
SplitBill Pro is a scalable fintech-grade social expense platform that enables users to split bills, track payments, and manage shared expenses across multiple currencies.

## Architecture
- **Frontend**: Expo React Native (SDK 54) with file-based routing (expo-router)
- **Backend**: FastAPI (Python) with async MongoDB driver (Motor)
- **Database**: MongoDB with proper indexing
- **Auth**: Internal session-based auth (cookie + Bearer token)
- **Exchange Rates**: Frankfurter API (free, no key required, 1-hour cache TTL)

## Features (MVP)

### 1. Authentication
- Internal session exchange and user provisioning
- Session-based auth with 7-day expiry
- Cookie + Authorization header support
- Automatic session validation
- Logout with session cleanup

### 2. Dashboard
- Total outstanding amount
- Active/settled bill counts
- Recent bills list
- Quick create bill FAB

### 3. Bill Creation (Multi-step)
- Step 1: Bill title + currency selection (16 currencies)
- Step 2: Add items (name, price, quantity) + tax & fees
- Step 3: Add participants + select split method
- Step 4: Review & create

### 4. Split Calculation Engine
- **Equal Split**: Total / participants with deterministic rounding
- **Per-Item Split**: Proportional based on assigned items + tax/fee distribution
- **Percentage Split**: Custom percentages per participant
- **Custom Split**: Manual amount entry
- Uses Python `Decimal` for precision, ROUND_HALF_UP strategy

### 5. Bill Detail View
- Full bill breakdown (subtotal, tax, service, total)
- Payment progress bar
- Inline item management (add/remove)
- Inline participant management (add/remove)
- Split method toggle (equal/per-item)
- Payment toggle per participant (paid/unpaid)

### 6. Payment Tracking
- Per-participant payment status (unpaid/partial/paid)
- Automatic bill status update (active → settled when all paid)
- Audit logging for all payment changes

### 7. Share System
- Generate secure share links (token-based, 72-hour expiry)
- Public read-only bill view
- Native share sheet integration
- Clipboard copy for web

### 8. Multi-Currency
- Real-time exchange rates from Frankfurter API
- 1-hour cache TTL in MongoDB
- 30+ supported currencies
- Rate locking per bill (architecture ready)

### 9. Bills List
- Search by title
- Filter by status (all/active/settled)
- Pull-to-refresh

### 10. Profile
- User info display
- Google account badge
- Settings menu structure
- Logout with confirmation

## API Endpoints

### Auth
- `POST /api/auth/session` - Exchange OAuth session_id
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout

### Bills
- `GET /api/bills` - List user's bills
- `POST /api/bills` - Create bill
- `GET /api/bills/{id}` - Get bill detail
- `PUT /api/bills/{id}` - Update bill
- `DELETE /api/bills/{id}` - Delete bill

### Items
- `POST /api/bills/{id}/items` - Add item
- `PUT /api/bills/{id}/items/{item_id}` - Update item
- `DELETE /api/bills/{id}/items/{item_id}` - Delete item

### Participants
- `POST /api/bills/{id}/participants` - Add participant
- `DELETE /api/bills/{id}/participants/{p_id}` - Remove participant

### Splits & Payments
- `POST /api/bills/{id}/split` - Recalculate split
- `PUT /api/bills/{id}/payments/{p_id}` - Update payment

### Exchange Rates
- `GET /api/exchange-rates?base=USD&target=EUR` - Get rate
- `GET /api/currencies` - Get supported currencies

### Share
- `POST /api/bills/{id}/share` - Create share link
- `GET /api/share/{token}` - View shared bill (public)

### Dashboard
- `GET /api/dashboard/stats` - Get dashboard statistics
- `GET /api/health` - Health check

## Database Collections
- `users` - User profiles
- `user_sessions` - Auth sessions
- `bills` - Bills with embedded items, participants, splits
- `exchange_rates` - Cached exchange rates
- `share_links` - Share link tokens
- `audit_logs` - Action audit trail

## Design System
- Theme: "Fintech Dark Lime" - Dark mode (#09090B) with Neon Lime (#D4F478) accents
- Surface: #18181B, Border: #27272A
- Typography: System fonts with tight tracking
- Cards: 24px border-radius, 1px borders
- Buttons: 56px height, rounded pill shape
- Icons: Ionicons from @expo/vector-icons

## Deferred Features (Architecture Ready)
- [ ] OCR Receipt Scanner (Gemini 3 Flash - modular service layer prepared)
- [ ] PDF/Image/Excel export engine
- [ ] Offline-first sync engine
- [ ] AI anomaly detection
- [ ] Group analytics dashboard
- [ ] Multi-tenant SaaS version

## Security
- All MongoDB queries exclude `_id` with `{"_id": 0}` projection
- Session tokens are cryptographically generated
- CORS enabled with credentials
- Input validation via Pydantic models
- Timezone-aware datetimes (UTC)
- Audit logging on critical actions
