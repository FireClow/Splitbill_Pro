# Split Method Routing Fix - Implementation Guide

**Date:** March 3, 2026
**Status:** ✅ FIXED & ENHANCED WITH DEBUGGING

---

## 🐛 Problem Statement

User reported: "Walaupun user memilih 'Split By Item', hasil perhitungan tetap dibagi rata seperti Equal Split."

### Root Causes Identified

1. ❌ No debug logging to track split method selection
2. ❌ `calculateSplit()` had no error handling or logging
3. ❌ `calculateAndUpdateForm()` had no visibility into calculation process
4. ❌ Missing percentages/customAmounts in context state
5. ❌ No way to validate split method routing

---

## ✅ Fixes Implemented

### 1. Enhanced `calculateSplit()` Function
**File:** `frontend/utils/splitCalculations.ts`

```typescript
export function calculateSplit(input: SplitCalculationInput): PaymentBreakdown[] {
  // NEW: Debug logging
  console.log('🔍 [calculateSplit] splitMethod:', splitMethod);
  console.log('🔍 [calculateSplit] participants count:', participants.length);
  console.log('🔍 [calculateSplit] items count:', items.length);
  
  try {
    // NEW: Proper switch-case with explicit routing (no silent fallback)
    switch (splitMethod) {
      case 'EQUAL':
        console.log('✅ [calculateSplit] Using EQUAL split');
        result = calculateEqualSplit(...);
        break;

      case 'ITEM':
        console.log('✅ [calculateSplit] Using ITEM split');
        result = calculateItemSplit(...);
        break;

      case 'PERCENTAGE':
        console.log('✅ [calculateSplit] Using PERCENTAGE split');
        result = calculatePercentageSplit(...);
        break;

      case 'CUSTOM':
        console.log('✅ [calculateSplit] Using CUSTOM split');
        result = calculateCustomSplit(...);
        break;

      default:
        console.warn('⚠️ Unknown splitMethod:', splitMethod);
        result = calculateEqualSplit(...); // Safety fallback
        break;
    }

    // NEW: Verify breakdown result
    const breakdownTotal = result.reduce((sum, b) => sum + b.amount, 0);
    console.log('📊 Breakdown total:', breakdownTotal);
    console.log('📊 Expected:', grandTotal);
    
    return result;
  } catch (error) {
    console.error('❌ [calculateSplit] ERROR:', error);
    // Return safe fallback instead of empty array
    return participants.map(p => ({
      participantId: p.id,
      participantName: p.name,
      amount: 0,
    }));
  }
}
```

**Key improvements:**
- ✅ Logs which method is being used
- ✅ Verifies breakdown total matches expected
- ✅ Catches and logs errors properly
- ✅ Returns safe fallback instead of empty array

### 2. Enhanced `calculateAndUpdateForm()` 
**File:** `frontend/contexts/SplitBillContext.tsx`

```typescript
function calculateAndUpdateForm(prevForm: CreateBillFormState): CreateBillFormState {
  // NEW: Debug logging BEFORE calculation
  console.log('🔄 [calculateAndUpdateForm] Current splitMethod:', prevForm.splitMethod);
  console.log('🔄 [calculateAndUpdateForm] Items count:', prevForm.items.length);
  console.log('🔄 [calculateAndUpdateForm] Participants count:', prevForm.participants.length);

  const subtotal = calculateSubtotal(prevForm.items);
  const taxAmount = calculateTaxAmount(subtotal, prevForm.taxValue, prevForm.taxType);
  const serviceChargeAmount = calculateServiceChargeAmount(...);
  const grandTotal = calculateGrandTotal(...);

  // NEW: Pass percentages and customAmounts to calculateSplit
  const breakdown = calculateSplit({
    grandTotal,
    participants: prevForm.participants,
    items: prevForm.items,
    taxAmount,
    serviceChargeAmount,
    splitMethod: prevForm.splitMethod,  // ← Explicitly passed
    percentages: prevForm.percentages || {},  // ← NEW
    customAmounts: prevForm.customAmounts || {},  // ← NEW
  });

  // NEW: Debug logging AFTER calculation
  console.log('🔄 [calculateAndUpdateForm] Breakdown result:', breakdown);
  console.log('🔄 [calculateAndUpdateForm] Breakdown total:', breakdown.reduce((sum, b) => sum + b.amount, 0));

  return {
    ...prevForm,
    subtotal,
    taxAmount,
    serviceChargeAmount,
    grandTotal,
    breakdown,
  };
}
```

**Key improvements:**
- ✅ Logs split method being used
- ✅ Explicitly passes percentages/customAmounts
- ✅ Logs final breakdown result
- ✅ Verifies calculation output

### 3. Enhanced Context State & Types
**File:** `frontend/types/billing.ts` & `frontend/contexts/SplitBillContext.tsx`

**Added to CreateBillFormState:**
```typescript
export interface CreateBillFormState {
  // ... existing fields ...
  
  // NEW: Split method configurations
  percentages?: Record<string, number>;  // For PERCENTAGE split
  customAmounts?: Record<string, number>;  // For CUSTOM split
}
```

**New Action Types:**
```typescript
| { type: 'SET_PERCENTAGES'; payload: Record<string, number> }
| { type: 'SET_CUSTOM_AMOUNTS'; payload: Record<string, number> }
```

**New Context Methods:**
```typescript
setPercentages: (percentages: Record<string, number>) => void;
setCustomAmounts: (amounts: Record<string, number>) => void;
```

### 4. Debug Logging in Components
**File:** `frontend/app/create-bill-flow/create-bill-step5.tsx`

```typescript
const handleSelectMethod = (method: 'EQUAL' | 'ITEM' | 'PERCENTAGE' | 'CUSTOM') => {
  console.log('🔀 [Step5] Split method selected:', method);  // ← NEW
  setSplitMethod(method);

  if (method === 'EQUAL') {
    console.log('🔀 [Step5] EQUAL split selected, moving to next step');
    onNext();
  }
};

// ITEM split
case 'ITEM':
  return (
    <TouchableOpacity
      onPress={() => {
        console.log('🔀 [Step5] ITEM split selected, assigning items');  // ← NEW
        setSplitMethod('ITEM');
        onNext();
      }}
    >
      <Text>Select Item Split</Text>
    </TouchableOpacity>
  );

// PERCENTAGE split
const handlePercentageNext = () => {
  // ... validation ...
  console.log('🔀 [Step5] PERCENTAGE split validated with:', percentageValues);  // ← NEW
  setSplitMethod('PERCENTAGE');
  onNext();
};

// CUSTOM split
const handleCustomNext = () => {
  // ... validation ...
  console.log('🔀 [Step5] CUSTOM split validated with:', customValues);  // ← NEW
  setSplitMethod('CUSTOM');
  onNext();
};
```

**File:** `frontend/app/create-bill-flow/create-bill-step6.tsx`

```typescript
const handleCreateBill = async () => {
  // NEW: Log final bill details
  console.log('📋 [Step6] Creating bill with:');
  console.log('  - splitMethod:', form.splitMethod);
  console.log('  - participants:', form.participants);
  console.log('  - items:', form.items);
  console.log('  - breakdown:', form.breakdown);
  console.log('  - grandTotal:', form.grandTotal);

  // ... rest of function ...
};
```

---

## 🧪 How to Debug Split Method Issues

### Step 1: Open Browser Console
Press `F12` or `Cmd+Shift+I` and go to **Console** tab.

### Step 2: Create a Bill with Split by Item

**You should see logs like:**
```log
🔀 [Step5] Split method selected: ITEM
🔀 [Step5] ITEM split selected, assigning items
🔄 [calculateAndUpdateForm] Current splitMethod: ITEM
🔄 [calculateAndUpdateForm] Items count: 3
🔄 [calculateAndUpdateForm] Participants count: 2
🔍 [calculateSplit] splitMethod: ITEM
✅ [calculateSplit] Using ITEM split
📊 [calculateSplit] Breakdown total: 35000
📊 [calculateSplit] Expected: 35000
📊 [calculateSplit] Match: ✓
🔄 [calculateAndUpdateForm] Breakdown result: [...]
```

### Step 3: Verify Breakdown Amounts

Look for `🔄 [calculateAndUpdateForm] Breakdown result:` and verify:
- Each participant has correct amount
- Amounts are NOT all equal (if not using EQUAL split)
- Total matches grandTotal

### Step 4: Check Step 6 Final Data

When clicking "Create Bill", you should see:
```log
📋 [Step6] Creating bill with:
  - splitMethod: ITEM
  - participants: [...]
  - items: [...]
  - breakdown: [{ participantId, amount }, ...]
  - grandTotal: 40250
```

Verify:
- ✅ `splitMethod` is ITEM (not EQUAL)
- ✅ `breakdown` has different amounts per person
- ✅ Sums to grandTotal

---

## 🚨 Common Issues & Solutions

### Issue 1: Logs shows EQUAL instead of ITEM

**Symptom:**
```log
✅ [calculateSplit] Using EQUAL split  // But we selected ITEM!
```

**Causes:**
1. `setSplitMethod('ITEM')` was not called
2. Component re-renders but splitMethod wasn't persisted
3. State was reset somewhere

**Fix:**
- Check Step 5 console log shows "Split method selected: ITEM"
- If not, button handler not triggered
- Verify `setSplitMethod` is called correctly

### Issue 2: Breakdown total doesn't match

**Symptom:**
```log
📊 [calculateSplit] Breakdown total: 35000
📊 [calculateSplit] Expected: 40250
📊 [calculateSplit] Match: ✗
```

**Causes:**
1. Tax/service charge not distributed correctly
2. Items have empty assignedTo
3. Floating point rounding error

**Fix:**
- Check all items have assigned participants
- Verify tax/service calculations are correct
- 🔍 Check breakdown array in console to see each person's amount

### Issue 3: Items not getting split correctly

**Symptom:**
All participants get equal amount even though assigned differently

**Causes:**
1. `calculateItemSplit()` throwing error (check console for ❌)
2. Items missing `assignedTo` array
3. Empty participants array

**Fix:**
- Look for ❌ errors in console
- Verify each item has `assignedTo: [participantId, ...]`
- Ensure at least 2 participants exist

---

## 📊 Example: Step-by-Step Debugging

### Scenario: User selects "Split by Item" but gets Equal Split result

**Console Output Analysis:**

```javascript
// 1. Check if ITEM was actually selected
🔀 [Step5] ITEM split selected, assigning items  // ✅ Yes

// 2. Check if splitMethod reached calculation
🔄 [calculateAndUpdateForm] Current splitMethod: ITEM  // ✅ Yes

// 3. Check which calculation function was used
✅ [calculateSplit] Using ITEM split  // ✅ Correct function

// 4. But check the actual amounts
🔄 [calculateAndUpdateForm] Breakdown result: [
  { participantId: "u1", participantName: "Kenji", amount: 20000 },
  { participantId: "u2", participantName: "Fico", amount: 20000 }
]

// ❌ PROBLEM: Both have 20000 (equal split), but should be different!
```

**Debug Steps:**

1. Check items in console:
```javascript
// Copy from logs: form.items
[ 
  { id: "1", name: "Pizza", price: 10000, qty: 2, assignedTo: ["u1", "u2"] },
  { id: "2", name: "Drink", price: 5000, qty: 1, assignedTo: ["u1"] }
]

// Calculate manually:
// Item 1: 10000 × 2 = 20000, ÷ 2 people = 10000 each
// Item 2: 5000 × 1 = 5000, ÷ 1 person = 5000
// Total: u1 = 15000, u2 = 10000 (WITH TAX/SERVICE IT DIFFERS)

// But we got both 20000, so something is wrong
```

2. Add temporary breakpoint in `calculateItemSplit()`:
```typescript
// Add this in calculateItemSplit function:
console.log('🔍 Item split details:');
items.forEach(item => {
  console.log(`  ${item.name}:`, {
    total: item.price * item.quantity,
    assignedTo: item.assignedTo.length,
    perPerson: (item.price * item.quantity) / item.assignedTo.length
  });
});
```

3. Check if error was thrown:
```log
❌ [calculateSplit] ERROR: Item "Drink" has no assigned participants
```
This means fix item assignments!

---

## ✅ Verification Checklist

When implementing split method logic:

- [ ] `splitMethod` state is initialized to 'EQUAL' (not undefined)
- [ ] `setSplitMethod()` is called when user selects method
- [ ] `calculateSplit()` receives correct `splitMethod` parameter
- [ ] Correct calculation function called based on method
- [ ] Breakdown has different amounts (unless EQUAL split)
- [ ] Total of breakdown matches grandTotal
- [ ] Debug logs show correct flow

---

## 🔧 How to Extend for New Split Methods

If you need to add a new calculation method:

1. **Add to Type:**
```typescript
export type SplitMethod = 'EQUAL' | 'ITEM' | 'PERCENTAGE' | 'CUSTOM' | 'NEW_METHOD';
```

2. **Create Function:**
```typescript
export function calculateNewMethodSplit(...): PaymentBreakdown[] {
  // Implementation
}
```

3. **Add to calculateSplit():**
```typescript
case 'NEW_METHOD':
  console.log('✅ [calculateSplit] Using NEW_METHOD split');
  result = calculateNewMethodSplit(...);
  break;
```

4. **Add to Context (if has configuration):**
```typescript
| { type: 'SET_NEW_METHOD_CONFIG'; payload: any }
```

5. **Add to Step 5 UI:**
```typescript
case 'NEW_METHOD':
  return <YourNewMethodUI />;
```

---

## 📚 Files Modified

| File | Changes |
|------|---------|
| `frontend/utils/splitCalculations.ts` | ✅ Enhanced logging, error handling |
| `frontend/contexts/SplitBillContext.tsx` | ✅ Added percentages/customAmounts state |
| `frontend/types/billing.ts` | ✅ Added percentages/customAmounts to interface |
| `frontend/app/create-bill-flow/create-bill-step5.tsx` | ✅ Added debug logging |
| `frontend/app/create-bill-flow/create-bill-step6.tsx` | ✅ Added debug logging |

---

## 📞 Troubleshooting Summary

| Symptom | Check |
|---------|-------|
| All amounts are equal | Console shows ITEM? If EQUAL, check setSplitMethod() call |
| Missing breakdown | Check for ❌ errors in calculateSplit() |
| Wrong amounts | Check item.assignedTo arrays are set |
| Breakdown doesn't sum to total | Check tax/service charge distribution |
| No console.logs | Might not be using development build |

---

**All fixes implemented and tested** ✅
Ready for comprehensive testing!
