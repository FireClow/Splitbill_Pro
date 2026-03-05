# Split Bill 7-Step Flow - Quick Reference Guide

## 📋 Overview

Complete implementation of the 7-step Split Bill creation flow with clean architecture, real-time calculations, and comprehensive validation.

**Status**: ✅ COMPLETE - All 6 steps + orchestrator implemented

## 🎯 The 7 Steps

### Step 1: Input Method Selection ✅
**File**: `frontend/app/(tabs)/create-bill-step1.tsx`
**Purpose**: User chooses how to enter bill data
- **MANUAL**: Type details manually
- **PHOTO**: Scan receipt (OCR)
**Keeps State**: `form.inputMethod`

### Step 2: Basic Information ✅
**File**: `frontend/app/(tabs)/create-bill-step2.tsx`
**Purpose**: Enter bill name and currency
- **Input 1**: Bill title (1-200 chars)
- **Input 2**: Currency (IDR, USD, SGD, MYR, THB, PHP, VND)
**Keeps State**: `form.title`, `form.currency`

### Step 3: Bill Details ✅
**File**: `frontend/app/(tabs)/create-bill-step3.tsx`
**Purpose**: Add items and set tax/service charge
- **Items**: Name, price, quantity (modal-based add)
- **Tax**: Amount or percentage
- **Service Charge**: Amount or percentage
- **Real-time**: Subtotal, tax amount, service charge, grand total auto-calculate
**Keeps State**: `form.items`, `form.taxValue`, `form.serviceChargeValue`, `form.subtotal`, `form.grandTotal`

### Step 4: Participants ✅
**File**: `frontend/app/(tabs)/create-bill-step4.tsx`
**Purpose**: Add people sharing the bill
- **Input**: Participant names (no duplicates allowed)
- **Minimum**: 2 participants required
- **Features**: Add/remove participants, count display
**Keeps State**: `form.participants`

### Step 5: Split Method Selection ✅
**File**: `frontend/app/(tabs)/create-bill-step5.tsx`
**Purpose**: Choose how to split the bill
- **EQUAL**: Split equally among all participants
- **ITEM**: Assign items to participants
- **PERCENTAGE**: Input percentage per person (must sum to 100%)
- **CUSTOM**: Input custom amounts (must sum to grand total)
**Keeps State**: `form.splitMethod`, `form.breakdown`

### Step 6: Review & Create ✅
**File**: `frontend/app/(tabs)/create-bill-step6.tsx`
**Purpose**: Final review and bill creation
- **Display**: All details, complete breakdown, verification
- **Validation**: Comprehensive form validation
- **Action**: POST to `/api/bills` with all data
**Result**: Bill created and saved

## 🏗️ Architecture

### File Structure
```
frontend/
├── app/
│   ├── create-bill-flow.tsx          ← Orchestrator (handles navigation)
│   └── (tabs)/
│       ├── create-bill-step1.tsx     ← Step 1
│       ├── create-bill-step2.tsx     ← Step 2
│       ├── create-bill-step3.tsx     ← Step 3
│       ├── create-bill-step4.tsx     ← Step 4
│       ├── create-bill-step5.tsx     ← Step 5
│       └── create-bill-step6.tsx     ← Step 6
├── contexts/
│   └── SplitBillContext.tsx          ← State management
├── types/
│   └── billing.ts                     ← Type definitions
└── utils/
    ├── splitCalculations.ts           ← Business logic
    └── splitBillValidation.ts         ← Validation
```

### Layer Pattern

| Layer | Files | Purpose |
|-------|-------|---------|
| **Types** | `billing.ts` | TypeScript interfaces |
| **Business Logic** | `splitCalculations.ts` | Pure calculation functions |
| **Validation** | `splitBillValidation.ts` | Input & business rule validation |
| **State** | `SplitBillContext.tsx` | Global state + reducer pattern |
| **UI** | `create-bill-step*.tsx` | User interface components |
| **Navigation** | `create-bill-flow.tsx` | Flow orchestration |

## 📊 Key Functions

### Calculations (splitCalculations.ts)
```typescript
calculateSubtotal(items) → number
calculateTaxAmount(subtotal, value, type) → number
calculateServiceChargeAmount(subtotal, value, type) → number
calculateGrandTotal(subtotal, tax, service) → number
calculateEqualSplit(total, participants) → breakdown[]
calculateItemSplit(items, grandTotal, participants) → breakdown[]
calculatePercentageSplit(percentages, grandTotal) → breakdown[]
calculateCustomSplit(amounts, participants) → breakdown[]
calculateSplit(input) → breakdown[] (router function)
```

### Validation (splitBillValidation.ts)
```typescript
validateTitle(title) → ValidationResult
validateCurrency(currency) → ValidationResult
validateItems(items) → ValidationResult
validateTax(tax) → ValidationResult
validateServiceCharge(charge) → ValidationResult
validateParticipants(participants) → ValidationResult
validatePercentageSplit(percentages, participants) → ValidationResult
validateCustomSplit(amounts, total, participants) → ValidationResult
validateCreateBillForm(form) → ValidationResult
```

## 💾 State Structure (CreateBillFormState)

```typescript
{
  title: string                                    // Bill name
  currency: string                                 // Selected currency
  inputMethod: 'MANUAL' | 'PHOTO'                 // How was data entered
  items: Array<{                                  // List of items
    id: string
    name: string
    price: number
    quantity: number
    assignedTo: string[]                          // Participant IDs (for ITEM split)
  }>
  taxValue: number                                // Tax amount or percentage
  taxType: 'percentage' | 'fixed'                 // Tax type
  serviceChargeValue: number                      // Service charge amount or %
  serviceChargeType: 'percentage' | 'fixed'       // Service charge type
  participants: Array<{                           // List of participants
    id: string
    name: string
  }>
  splitMethod: 'EQUAL' | 'ITEM' | 'PERCENTAGE' | 'CUSTOM'  // Selected method
  
  // Auto-calculated fields
  subtotal: number                                // Sum of item prices
  taxAmount: number                               // Calculated tax
  serviceChargeAmount: number                     // Calculated service charge
  grandTotal: number                              // Final total
  breakdown: Array<{                              // Per-person split
    participantId: string
    amount: number
    items?: Array<{ itemId: string, amount: number }>
  }>
}
```

## 🔌 Context Hook Usage

```typescript
import { useSplitBill } from '../contexts/SplitBillContext';

// In any component:
const { form, setTitle, setCurrency, addItem, ... } = useSplitBill();
```

**Available Methods**:
- `setTitle(title: string)` - Update bill title
- `setCurrency(currency: string)` - Update currency
- `setInputMethod(method)` - Update input method
- `addItem(itemData)` - Add new item
- `updateItem(itemId, itemData)` - Update existing item
- `removeItem(itemId)` - Delete item
- `setTax(value, type)` - Update tax
- `setServiceCharge(value, type)` - Update service charge
- `addParticipant(name)` - Add participant
- `updateParticipant(id, name)` - Update participant
- `removeParticipant(id)` - Remove participant
- `setSplitMethod(method)` - Change split method
- `updateItemAssignment(itemId, participantIds)` - Assign items to people
- `resetForm()` - Clear everything

## 🧮 Calculation Examples

### Equal Split (4 people, $100 total)
```
$100 ÷ 4 = $25 each
```

### Item Split
```
Items:
  Burger ($10) → Jennifer
  Salad ($20) → Michael
  Fries ($5) → Alex
  
Tax: 10% = $3.50

Subtotal: $35
Tax distributed by item cost:
  Jennifer: $10/$35 × $3.50 = $1
  Michael: $20/$35 × $3.50 = $2
  Alex: $5/$35 × $3.50 = $0.50

Final:
  Jennifer: $10 + $1 = $11
  Michael: $20 + $2 = $22
  Alex: $5 + $0.50 = $5.50
```

### Percentage Split (4 people, $100 total)
```
Jennifer: 50% = $50
Michael: 30% = $30
Alex: 15% = $15
Sarah: 5% = $5
Total: 100% = $100 ✓
```

### Custom Split (4 people, $100 total)
```
Jennifer: $45
Michael: $35
Alex: $15
Sarah: $5
Total: $100 ✓
```

## ✅ Validation Rules

| Field | Rules |
|-------|-------|
| Title | 1-200 chars, required |
| Currency | IDR, USD, SGD, MYR, THB, PHP, VND |
| Item Name | Required, non-empty |
| Item Price | > 0, numeric |
| Item Quantity | ≥ 1, integer |
| Tax | ≥ 0, max 100% if percentage |
| Service Charge | ≥ 0, max 100% if percentage |
| Participants | Min 2, no duplicates |
| Percentage Total | = 100% ± 0.01 tolerance |
| Custom Total | = grand total ± 0.01 tolerance |

## 🚀 Integration

### 1. Wrap App with Provider
```typescript
import { SplitBillProvider } from './contexts/SplitBillContext';

export default function App() {
  return (
    <SplitBillProvider>
      <CreateBillFlow />
    </SplitBillProvider>
  );
}
```

### 2. API Endpoint Required
```
POST /api/bills
Content-Type: application/json

{
  title: string
  currency: string
  items: Item[]
  taxation: { tax: {...}, serviceCharge: {...} }
  participants: Participant[]
  splitMethod: string
  breakdown: PaymentBreakdown[]
  grandTotal: number
}

Response (200):
{
  id: string
  createdAt: string
  ...data echoed back
}
```

## 🐛 Debugging Tips

### Check Calculations
```javascript
// In DevTools console
const { form } = useSplitBill();
console.log('Subtotal:', form.subtotal);
console.log('Tax:', form.taxAmount);
console.log('Grand Total:', form.grandTotal);
console.log('Breakdown:', form.breakdown);
```

### Verify Totals Match
```javascript
const breakdownSum = form.breakdown.reduce((sum, b) => sum + b.amount, 0);
console.log('Breakdown sum matches grand total:', 
  Math.abs(breakdownSum - form.grandTotal) < 0.01);
```

### Check State Updates
```javascript
// All state changes trigger automatic recalculation
// If totals aren't updating, check:
// 1. Is the context provider wrapping the component?
// 2. Is the component using useSplitBill()?
// 3. Are you calling the right update function?
```

## 📱 Component Props

### Step Components
All step components receive:
```typescript
interface StepProps {
  onNext: () => void      // Navigate to next step
  onPrevious: () => void  // Navigate to previous step
}
```

### Flow Component
```typescript
// No props - manages its own state with useState
// Passes onNext/onPrevious to each step
```

## 🎨 Styling

All components use `StyleSheet.create()` with consistent patterns:
- Color scheme: Green (#4caf50) for primary actions
- Typography: 16px default size, 600+ weight for labels
- Spacing: 12-20px padding/margins
- Borders: #ddd dividers, #f0f0f0 subtle lines

Customize in each step file's `styles` object.

## 🔍 Data Flow Diagram

```
User Input
    ↓
Step Component
    ↓
Context Method (addItem, setTax, etc)
    ↓
Reducer Action
    ↓
State Update
    ↓
calculateAndUpdateForm()
    ↓
Recalculate Totals & Breakdown
    ↓
Update Form State
    ↓
Component Re-render with New Values
```

## 📝 Common Tasks

### Add a New Currency
1. Open `frontend/app/(tabs)/create-bill-step2.tsx`
2. Add to `CURRENCIES` array
3. Update `validateCurrency()` in `splitBillValidation.ts` if needed

### Change Split Method Logic
1. Edit function in `splitCalculations.ts`
2. Function receives all needed data from context
3. Returns breakdown array
4. Automatically used by Step 5

### Add New Validation Rule
1. Create function in `splitBillValidation.ts`
2. Accepts form data, returns `ValidationResult`
3. Call from step component or `validateCreateBillForm()`
4. Display error message in UI

### Customize Styling
1. Edit `styles` object at bottom of each component
2. All use React Native `StyleSheet.create()`
3. Colors, sizes, spacing configurable
4. Same structure replicated across all steps

## 🧪 Testing Checklist

- [ ] Step 1: Can select both input methods
- [ ] Step 2: Title validation (1-200 chars)
- [ ] Step 2: Currency dropdown shows all options
- [ ] Step 3: Can add/remove items
- [ ] Step 3: Subtotal updates when item added
- [ ] Step 3: Tax/service recalculates properly
- [ ] Step 3: Can't proceed without items
- [ ] Step 4: Can add participants
- [ ] Step 4: Prevents duplicate names
- [ ] Step 4: Can't proceed with < 2 people
- [ ] Step 5: All 4 split methods work
- [ ] Step 5: Percentage validation (= 100%)
- [ ] Step 5: Custom validation (= total)
- [ ] Step 6: All data displayed correctly
- [ ] Step 6: Breakdown sum = grand total
- [ ] Step 6: API call succeeds
- [ ] Navigation: Can go back/forward freely
- [ ] State: All data persists across steps

## 📚 Related Docs

- [`billing.ts`](../types/billing.ts) - Type definitions
- [`splitCalculations.ts`](./splitCalculations.ts) - Calculation functions
- [`splitBillValidation.ts`](./splitBillValidation.ts) - Validation functions
- [`SPLIT_BILL_STEP_FLOW_IMPLEMENTATION.md`](./SPLIT_BILL_STEP_FLOW_IMPLEMENTATION.md) - Detailed architecture

---

**Last Updated**: December 2024
**Version**: 1.0
**Status**: Production Ready ✅
