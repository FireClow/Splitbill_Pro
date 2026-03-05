# Currency Settings Feature

## Overview

Pengguna sekarang dapat mengatur mata uang utama (preferred currency) mereka. Semua tampilan outstanding amount dan analytics akan ditampilkan dalam mata uang yang dipilih dengan konversi otomatis dari mata uang asli tagihan.

## Features

### 1. Preferred Currency Settings
- **Lokasi**: Profile → Currency Settings
- **Akses**: Dari tab Profile, tap "Currency Settings"
- **Opsi**: 30+ mata uang yang didukung (USD, EUR, GBP, JPY, IDR, SGD, dll)

### 2. Automatic Conversion
Semua jumlah dikonversi otomatis menggunakan:
- **Exchange Rate API**: frankfurter.dev untuk realtime rates
- **Caching**: Rates di-cache selama 1 jam
- **Precision**: 2 desimal untuk akurasi

### 3. Displays Updated
Mata uang pilihan ditampilkan di:
- **Home Screen**: Outstanding amount dengan currency code
- **Analytics Screen**: 
  - Total Spent dengan currency badge
  - Average Bill dengan currency
  - Monthly Spending chart dengan currency
- **Dashboard**: Currency field di stats response

## Backend Implementation

### Models

```python
class UserPreferencesUpdate(BaseModel):
    preferred_currency: str = Field(min_length=3, max_length=3)
    
    @field_validator("preferred_currency")
    @classmethod
    def validate_currency(cls, v: str) -> str:
        return v.upper()
```

### Database
Field `preferred_currency` ditambahkan ke collection `users`:
```json
{
  "user_id": "user_xxx",
  "email": "user@example.com",
  "preferred_currency": "USD",  // <-- New field
  "plan": "free",
  "created_at": "2026-03-02T..."
}
```

### API Endpoints

#### Get User Preferences
```
GET /api/user/preferences
Authorization: Bearer <token>

Response:
{
  "user_id": "user_xxx",
  "preferred_currency": "USD"
}
```

#### Update User Preferences
```
PUT /api/user/preferences
Authorization: Bearer <token>
Content-Type: application/json

Request:
{
  "preferred_currency": "EUR"
}

Response:
{
  "user_id": "user_xxx",
  "preferred_currency": "EUR"
}
```

### Updated Endpoints

#### Dashboard Stats
```
GET /api/dashboard/stats

Response:
{
  "total_bills": 5,
  "outstanding": 150.50,
  "currency": "USD",  // <-- Added
  "plan": "free"
}
```

#### Analytics Summary
```
GET /api/analytics/summary

Response:
{
  "total_spent": 500.00,
  "average_bill": 100.00,
  "preferred_currency": "USD",  // <-- Added
  "plan": "free"
}
```

#### Analytics Spending
```
GET /api/analytics/spending

Response:
{
  "spending": [...],
  "currency": "USD",  // <-- Added
  "is_pro": false
}
```

## Frontend Implementation

### Settings Screen
**File**: `frontend/app/settings.tsx`

Fitur:
- Currency picker dengan 30 pilihan
- Current selection display
- Info box explaining how it works
- Real-time update ke server

### Updated Components

#### Home Screen
```tsx
<View style={styles.currencyRow}>
  <Text style={styles.currencyCode}>{stats?.currency}</Text>
  <Text style={styles.statValuePrimary}>$1,500.00</Text>
</View>
```

#### Analytics Screen
```tsx
<View style={styles.sectionHeader}>
  <Text style={styles.sectionTitle}>Monthly Spending</Text>
  <Text style={styles.currencyBadge}>USD</Text>
</View>
```

## Architecture

### Currency Conversion Flow

```
User sets preferred_currency = "EUR"
                ↓
API endpoints receive user request
                ↓
For each bill with currency != EUR:
  - Fetch or cache exchange rate
  - Convert amount: amount * rate
  - Round to 2 decimals
                ↓
Return converted totals with currency code
                ↓
Frontend displays Currency Badge + Amount
```

### Exchange Rate Caching

```python
async def convert_currency(
    amount: float, 
    from_currency: str, 
    to_currency: str
) -> float:
    # Check cache first
    rate_doc = await db.exchange_rates.find_one({
        "base_currency": from_currency,
        "target_currency": to_currency
    })
    
    if cached and fresh (< 1 hour old):
        return amount * cached_rate
    
    # Fetch from API
    rate = await fetch_from_frankfurter_api()
    
    # Cache for 1 hour
    await db.exchange_rates.update_one({...}, {"$set": {...}}, upsert=True)
    
    return amount * rate
```

## Usage Examples

### 1. Set Preferred Currency
```typescript
// Frontend
await api.updateUserPreferences({ 
  preferred_currency: "SGD" 
});
```

```bash
# cURL
curl -X PUT http://localhost:8001/api/user/preferences \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"preferred_currency":"SGD"}'
```

### 2. View Outstanding in Preferred Currency
```typescript
const stats = await api.getDashboardStats();
console.log(`${stats.currency} ${stats.outstanding}`);
// Output: "SGD 2500.00"
```

### 3. View Analytics with Conversion
```typescript
const summary = await api.getAnalyticsSummary();
console.log(`Total spent: ${summary.preferred_currency} ${summary.total_spent}`);
// Output: "Total spent: EUR 5000.00"
```

## Testing

### Run Preference Tests
```bash
cd backend
pytest tests/test_09_user_preferences.py -v
```

### Test Cases
1. ✅ Get user preferences
2. ✅ Update to various currencies
3. ✅ Preferences persist
4. ✅ Dashboard stats includes currency
5. ✅ Analytics includes currency
6. ✅ Invalid currencies rejected
7. ✅ Case insensitivity

## Supported Currencies

| Code | Name |
|------|------|
| USD | US Dollar |
| EUR | Euro |
| GBP | British Pound |
| JPY | Japanese Yen |
| AUD | Australian Dollar |
| CAD | Canadian Dollar |
| CHF | Swiss Franc |
| CNY | Chinese Yuan |
| INR | Indian Rupee |
| SGD | Singapore Dollar |
| HKD | Hong Kong Dollar |
| NZD | New Zealand Dollar |
| KRW | South Korean Won |
| MXN | Mexican Peso |
| BRL | Brazilian Real |
| ZAR | South African Rand |
| SEK | Swedish Krona |
| NOK | Norwegian Krone |
| DKK | Danish Krone |
| THB | Thai Baht |
| IDR | Indonesian Rupiah |
| MYR | Malaysian Ringgit |
| PHP | Philippine Peso |
| TWD | Taiwan Dollar |
| TRY | Turkish Lira |
| PLN | Polish Zloty |
| CZK | Czech Koruna |
| HUF | Hungarian Forint |
| ILS | Israeli Shekel |
| AED | UAE Dirham |

## Notes

- Default preferred currency: USD
- Currency codes are case-insensitive (eur → EUR)
- Exchange rates cached for 1 hour to improve performance
- All conversions rounded to 2 decimal places
- Works with existing multi-currency bills seamlessly
- No changes needed in bill creation - just set conversion on display

## Migration
Existing users automatically get USD as default preferred_currency when they next login.
