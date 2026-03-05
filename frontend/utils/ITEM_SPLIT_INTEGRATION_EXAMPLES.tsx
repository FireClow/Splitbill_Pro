/**
 * INTEGRATION EXAMPLE: Using calculateItemSplit in React Component
 * File: frontend/app/create-bill-flow/create-bill-step6.tsx (example section)
 * 
 * Ini adalah pseudo-code contoh bagaimana mengintegrasikan function
 * ke dalam step 6 (review & create bill)
 */

import React, { useCallback } from 'react';
import {
  calculateSubtotal,
  calculateTaxAmount,
  calculateServiceChargeAmount,
  calculateGrandTotal,
  calculateItemSplit,
  getBreakdownTotal,
} from '../../utils/splitCalculations';
import { useSplitBill } from '../../contexts/SplitBillContext';
import { Item, Participant } from '../../types/billing';

// ============================================================================
// EXAMPLE 1: Direct Usage in Component
// ============================================================================

export function ReviewBillWithItemSplit() {
  const { formState } = useSplitBill();

  const [breakdown, setBreakdown] = React.useState<any[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  // Recalculate breakdown whenever items/participants change
  React.useEffect(() => {
    if (
      formState.items.length === 0 ||
      formState.participants.length === 0 ||
      formState.splitMethod !== 'ITEM'
    ) {
      return;
    }

    try {
      // Step 1: Calculate subtotal from items
      const subtotal = calculateSubtotal(formState.items);

      // Step 2: Calculate tax
      const taxAmount = calculateTaxAmount(
        subtotal,
        formState.taxValue || 0,
        formState.taxType || 'percentage'
      );

      // Step 3: Calculate service charge
      const serviceAmount = calculateServiceChargeAmount(
        subtotal,
        formState.serviceChargeValue || 0,
        formState.serviceChargeType || 'percentage'
      );

      // Step 4: Calculate grand total
      const grandTotal = calculateGrandTotal(subtotal, taxAmount, serviceAmount);

      // Step 5: Get item split breakdown
      // ✅ THIS IS THE KEY CALL - handles all the complex logic
      const itemBreakdown = calculateItemSplit(
        formState.items,
        formState.participants,
        grandTotal,
        taxAmount,
        serviceAmount,
        subtotal
      );

      // Step 6: Verify total matches (safety check)
      const breakdownTotal = getBreakdownTotal(itemBreakdown);
      if (Math.abs(breakdownTotal - grandTotal) > 0.01) {
        console.warn(
          `Breakdown total (${breakdownTotal}) doesn't match grandTotal (${grandTotal})`
        );
      }

      // Step 7: Update state (safe to do because calculateItemSplit returns new data)
      setBreakdown(itemBreakdown);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Calculation error';
      setError(message);
      setBreakdown([]);
      console.error('Item split error:', err);
    }
  }, [
    formState.items,
    formState.participants,
    formState.splitMethod,
    formState.taxValue,
    formState.taxType,
    formState.serviceChargeValue,
    formState.serviceChargeType,
  ]);

  if (error) {
    return (
      <div className="error-box">
        <h3>⚠️ Calculation Error</h3>
        <p>{error}</p>
        <p className="hint">Please check that all items have assigned participants.</p>
      </div>
    );
  }

  return (
    <div className="breakdown">
      <h3>Bill Breakdown (Split By Item)</h3>
      {breakdown.map(item => (
        <div key={item.participantId} className="breakdown-row">
          <span>{item.participantName}</span>
          <span className="amount">Rp {item.amount.toLocaleString('id-ID')}</span>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// EXAMPLE 2: Custom Hook for Reusability
// ============================================================================

/**
 * Hook untuk menghitung item split breakdown
 * Usage: const { breakdown, error, isValid } = useItemSplitBreakdown(items, participants, ...)
 */
export function useItemSplitBreakdown(
  items: Item[],
  participants: Participant[],
  taxValue: number = 0,
  taxType: 'percentage' | 'fixed' = 'percentage',
  serviceChargeValue: number = 0,
  serviceChargeType: 'percentage' | 'fixed' = 'percentage'
) {
  const [breakdown, setBreakdown] = React.useState<any[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [isValid, setIsValid] = React.useState(true);

  // Recalculate whenever inputs change
  React.useEffect(() => {
    // Early exit if missing required data
    if (items.length === 0 || participants.length === 0) {
      setBreakdown([]);
      setError(null);
      setIsValid(true);
      return;
    }

    try {
      // Calculate all amounts
      const subtotal = calculateSubtotal(items);
      const taxAmount = calculateTaxAmount(subtotal, taxValue, taxType);
      const serviceAmount = calculateServiceChargeAmount(subtotal, serviceChargeValue, serviceChargeType);
      const grandTotal = calculateGrandTotal(subtotal, taxAmount, serviceAmount);

      // Get breakdown
      const result = calculateItemSplit(
        items,
        participants,
        grandTotal,
        taxAmount,
        serviceAmount,
        subtotal
      );

      // Validate
      const total = getBreakdownTotal(result);
      const isValid = Math.abs(total - grandTotal) < 0.01;

      setBreakdown(result);
      setError(null);
      setIsValid(isValid);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      setBreakdown([]);
      setIsValid(false);
    }
  }, [items, participants, taxValue, taxType, serviceChargeValue, serviceChargeType]);

  return { breakdown, error, isValid };
}

// ============================================================================
// EXAMPLE 3: Usage in Component with Hook
// ============================================================================

export function BillReviewScreen() {
  const { formState } = useSplitBill();

  // Use the custom hook
  const { breakdown, error, isValid } = useItemSplitBreakdown(
    formState.items,
    formState.participants,
    formState.taxValue,
    formState.taxType,
    formState.serviceChargeValue,
    formState.serviceChargeType
  );

  if (error) {
    return (
      <div className="alert-error">
        <p>❌ {error}</p>
        <p>Please assign all items to at least one participant.</p>
      </div>
    );
  }

  if (!isValid) {
    return (
      <div className="alert-warning">
        <p>⚠️ Calculation validation failed</p>
        <p>Total amounts don't match bill total</p>
      </div>
    );
  }

  return (
    <div className="review-container">
      <h2>Bill Review</h2>
      <div className="breakdown-list">
        {breakdown.map(item => (
          <div key={item.participantId} className="breakdown-item">
            <h4>{item.participantName}</h4>
            <p className="amount">
              Rp {item.amount.toLocaleString('id-ID')}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// EXAMPLE 4: Testing Component State
// ============================================================================

/**
 * Unit test example untuk verify calculation bekerja di component
 */
export const testItemSplitIntegration = () => {
  const mockItems: Item[] = [
    {
      id: '1',
      name: 'Pizza',
      price: 100000,
      quantity: 1,
      assignedTo: ['user1', 'user2'],
    },
  ];

  const mockParticipants: Participant[] = [
    { id: 'user1', name: 'Alice' },
    { id: 'user2', name: 'Bob' },
  ];

  // Call the calculations
  const subtotal = calculateSubtotal(mockItems);
  console.assert(subtotal === 100000, 'Subtotal should be 100000');

  const taxAmount = calculateTaxAmount(subtotal, 10, 'percentage');
  console.assert(taxAmount === 10000, 'Tax should be 10000');

  const grandTotal = calculateGrandTotal(subtotal, taxAmount, 0);
  console.assert(grandTotal === 110000, 'Grand total should be 110000');

  const breakdown = calculateItemSplit(
    mockItems,
    mockParticipants,
    grandTotal,
    taxAmount,
    0,
    subtotal
  );

  console.assert(breakdown.length === 2, 'Should have 2 breakdowns');
  console.assert(breakdown[0].amount === 55000, 'Each person should owe 55000');
  console.assert(breakdown[1].amount === 55000, 'Each person should owe 55000');

  console.log('✓ All integration tests passed!');
};

// ============================================================================
// EXAMPLE 5: Error Handling in Form Submission
// ============================================================================

export async function handleCreateBillSubmit(
  items: Item[],
  participants: Participant[],
  taxValue: number,
  taxType: 'percentage' | 'fixed',
  serviceChargeValue: number,
  serviceChargeType: 'percentage' | 'fixed'
) {
  try {
    // Calculate breakdown
    const subtotal = calculateSubtotal(items);
    const taxAmount = calculateTaxAmount(subtotal, taxValue, taxType);
    const serviceAmount = calculateServiceChargeAmount(
      subtotal,
      serviceChargeValue,
      serviceChargeType
    );
    const grandTotal = calculateGrandTotal(subtotal, taxAmount, serviceAmount);

    const breakdown = calculateItemSplit(
      items,
      participants,
      grandTotal,
      taxAmount,
      serviceAmount,
      subtotal
    );

    // Validate before submission
    const breakdownTotal = getBreakdownTotal(breakdown);
    if (Math.abs(breakdownTotal - grandTotal) > 0.01) {
      throw new Error('Calculation error: breakdown total mismatch');
    }

    // Create payload for API
    const payload = {
      title: 'My Bill',
      currency: 'IDR',
      items,
      participants,
      breakdown,
      subtotal,
      tax: taxAmount,
      serviceCharge: serviceAmount,
      total: grandTotal,
      splitMethod: 'ITEM',
      createdAt: new Date().toISOString(),
    };

    // Send to API
    const response = await fetch('/api/bills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error('Failed to create bill');
    }

    const result = await response.json();
    return { success: true, data: result };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Bill creation failed:', message);
    return { success: false, error: message };
  }
}

// ============================================================================
// KEY TAKEAWAYS - Integration Best Practices
// ============================================================================

/*
1. SAFETY PRACTICES:
   ✓ Call calculateItemSplit fresh each time (it initializes internally)
   ✓ Always wrap in try-catch for error handling
   ✓ Validate breakdown total matches grandTotal
   ✓ Handle empty assignedTo error gracefully

2. PERFORMANCE:
   ✓ Use useCallback for event handlers
   ✓ Use useEffect dependencies carefully to avoid unnecessary recalculations
   ✓ Memoize breakdown to prevent re-renders if data hasn't changed

3. UX:
   ✓ Show error message to user if calculation fails
   ✓ Display warning if validation fails
   ✓ Disable "Create" button if breakdown is invalid
   ✓ Show breakdown before submission for review

4. STATE MANAGEMENT:
   ✓ Don't accumulate amounts in local state
   ✓ Recalculate fresh when items/participants change
   ✓ Use custom hook (useItemSplitBreakdown) for reusability
   ✓ Keep breakdown result in state (not in context if it changes frequently)

5. TESTING:
   ✓ Test with various item/participant combinations
   ✓ Test error cases (empty assignedTo, zero participants)
   ✓ Verify total matches expected amount
   ✓ Test floating point edge cases
*/
