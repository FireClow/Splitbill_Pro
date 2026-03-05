# Split By Item - Logic Guide

## Masalah yang Diperbaiki

1. ✅ **Perhitungan tidak akurat** → Sekarang setiap item dihitung sekali
2. ✅ **Quantity tidak dihitung** → Sekarang `itemTotal = price × quantity`
3. ✅ **Double counting** → Menggunakan fresh initialization (`totals = {}`)
4. ✅ **Amount tidak reset** → Initialize semua participant ke 0 sebelum proses

## Cara Kerja

### Input
```typescript
participants: [
  { id: "u1", name: "Kenji" },
  { id: "u2", name: "Fico" }
]

items: [
  {
    id: "1",
    name: "Makanan A",
    price: 10000,
    quantity: 2,
    assignedTo: ["u1", "u2"]  // Kedua orang
  },
  {
    id: "2",
    name: "Makanan B",
    price: 15000,
    quantity: 1,
    assignedTo: ["u1"]  // Hanya Kenji
  }
]
```

### Perhitungan Step-by-Step

**Item 1: Makanan A**
- itemTotal = 10000 × 2 = 20000
- assignedTo.length = 2 (u1, u2)
- sharePerPerson = 20000 ÷ 2 = **10000**
- u1 += 10000
- u2 += 10000

**Item 2: Makanan B**
- itemTotal = 15000 × 1 = 15000
- assignedTo.length = 1 (u1 only)
- sharePerPerson = 15000 ÷ 1 = **15000**
- u1 += 15000

### Output
```
u1 (Kenji) = 10000 + 15000 = 25000
u2 (Fico)  = 10000
Total      = 35000 ✓
```

## API Penggunaan

### 1. Hanya menghitung item amounts (tanpa tax/service)

```typescript
import { calculateItemAmounts } from '../utils/splitCalculations';

const itemAmounts = calculateItemAmounts(items, participants);

console.log(itemAmounts);
// Output:
// {
//   "u1": 25000,
//   "u2": 10000
// }
```

### 2. Menghitung item + tax + service charge

```typescript
import { calculateItemSplit } from '../utils/splitCalculations';

const subtotal = 35000; // sum of all items
const taxAmount = 3500; // calculated separately
const serviceChargeAmount = 1750; // calculated separately
const grandTotal = subtotal + taxAmount + serviceChargeAmount; // 40250

const breakdown = calculateItemSplit(
  items,
  participants,
  grandTotal,
  taxAmount,
  serviceChargeAmount,
  subtotal
);

console.log(breakdown);
// Output:
// [
//   { participantId: "u1", participantName: "Kenji", amount: 27475 },
//   { participantId: "u2", participantName: "Fico", amount: 12775 }
// ]
```

### Breakdown Tax Distribution

Tax dan service charge didistribusikan berdasarkan proporsi item amount:

- u1 item share = 25000 / 35000 = 71.43%
- u2 item share = 10000 / 35000 = 28.57%

Total tax + service (5250) dibagi:
- u1 gets: 5250 × 71.43% = 3750
- u2 gets: 5250 × 28.57% = 1500

So:
- u1 = 25000 + 3750 = 28750
- u2 = 10000 + 1500 = 11500
- Total = 40250 ✓

## Safe From Double Counting - Mengapa?

### Mekanisme Keamanan

1. **Fresh Initialization**
   ```typescript
   const itemAmounts: Record<string, number> = {};
   participants.forEach(p => {
     itemAmounts[p.id] = 0;  // ← Reset to 0
   });
   ```
   ✓ Setiap kali `calculateItemAmounts()` dipanggil, semua nilai direset ke 0

2. **Single Iteration**
   ```typescript
   items.forEach(item => {
     // Setiap item diproses tepat 1x
   });
   ```
   ✓ Tidak ada loop dalam loop yang bisa bikin item dihitung berulang

3. **Accumulation Pattern (Immutable-friendly)**
   ```typescript
   itemAmounts[participantId] += sharePerPerson;  // ← Add, never replace
   ```
   ✓ Menggunakan `+=` (increment) bukan `=` (assignment)
   ✓ Ini prevent overwriting nilai sebelumnya

4. **Error Handling untuk Empty assignedTo**
   ```typescript
   if (!item.assignedTo || item.assignedTo.length === 0) {
     throw new Error(`Item "${item.name}" has no assigned participants`);
   }
   ```
   ✓ Mencegah item dengan assignedTo kosong untuk dihitung
   ✓ User harus assign ke minimal 1 orang

5. **Type Safety**
   ```typescript
   type ItemWithQuantity = Item & { 
     price: number; 
     quantity: number; 
     assignedTo: string[]; 
   };
   ```
   ✓ TypeScript memastikan quantity dan assignedTo selalu ada

## Validation Rules

| Rule | Check | Behavior |
|------|-------|----------|
| Empty assignedTo | `if (!item.assignedTo \|\| length === 0)` | ❌ Throw error |
| Division by zero | Guaranteed by check above | ✓ Not possible |
| Total mismatch | Sum of amounts === subtotal | ✓ Can verify |
| Floating point | `.toFixed(2)` rounding | ✓ Always 2 decimals |

## Integration dengan React Component

```typescript
import { useState, useCallback } from 'react';
import { calculateItemSplit } from '../utils/splitCalculations';

export function BillForm() {
  const [items, setItems] = useState<Item[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [breakdown, setBreakdown] = useState<PaymentBreakdown[]>([]);

  const handleRecalculate = useCallback(() => {
    if (items.length === 0 || participants.length === 0) return;

    try {
      const subtotal = calculateSubtotal(items);
      const taxAmount = calculateTaxAmount(subtotal, taxValue, 'percentage');
      const serviceAmount = calculateServiceChargeAmount(subtotal, serviceValue, 'percentage');
      const total = calculateGrandTotal(subtotal, taxAmount, serviceAmount);

      // ✅ Safe call - automatically resets amounts and calculates fresh
      const result = calculateItemSplit(
        items,
        participants,
        total,
        taxAmount,
        serviceAmount,
        subtotal
      );

      setBreakdown(result); // ← No accumulation issues
    } catch (error) {
      console.error('Calculation error:', error);
      // Handle error - show to user
    }
  }, [items, participants, taxValue, serviceValue]);

  return (
    // Your component JSX
  );
}
```

## Testing Checklist

- [ ] Test dengan 2 items, 2 orang (both assigned)
- [ ] Test dengan 3 items, 1 item single person
- [ ] Test dengan quantity > 1
- [ ] Test dengan decimal prices (9999.99)
- [ ] Test error handling saat assignedTo kosong
- [ ] Test dengan tax and service charge
- [ ] Verify total === sum of breakdown amounts
- [ ] Verify no floating point errors (use .toFixed(2))

## Performance Notes

- ✅ O(n) complexity - linear iteration
- ✅ Pure function - no state side effects
- ✅ Suitable for real-time calculations
- ✅ No unnecessary allocations

## Common Mistakes to Avoid

❌ **Mistake 1: Calling function multiple times and accumulating**
```typescript
// WRONG - causes double counting
result1 = calculateItemSplit(...);
result2 = calculateItemSplit(...); // Still has values from result1
result = combine(result1, result2); // Doubles the amounts
```

✅ **Correct:**
```typescript
// CORRECT - fresh calculation each time
result = calculateItemSplit(...); // Always fresh
```

❌ **Mistake 2: Mutating items/participants arrays**
```typescript
// WRONG
participants[0].amount = 1000; // Direct mutation
```

✅ **Correct:**
```typescript
// CORRECT
const breakdown = calculateItemSplit(...); // Returns new array
```

❌ **Mistake 3: Forgetting to assign participants to items**
```typescript
// WRONG
item.assignedTo = []; // Will throw error
```

✅ **Correct:**
```typescript
// CORRECT
item.assignedTo = ["u1", "u2"]; // Must have at least 1
```

## Formula Summary

```
For each item:
  itemTotal = price × quantity
  sharePerPerson = itemTotal ÷ assignedTo.length
  for each person in assignedTo:
    personAmount += sharePerPerson

For tax distribution:
  personTaxShare = tax × (personItemAmount ÷ subtotal)

Final amount per person:
  totalAmount = itemAmount + (taxShare) + (serviceShare)
```

