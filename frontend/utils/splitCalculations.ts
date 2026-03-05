/**
 * Business Logic Layer - Calculation Functions
 * File: frontend/utils/billCalculations.ts
 * 
 * All calculation functions for different split methods
 * Pure functions - no side effects
 */

import { Item, Participant, PaymentBreakdown, SplitCalculationInput } from '../types/billing';

/**
 * Calculate subtotal from items
 * Formula: sum(item.price × item.quantity)
 */
export function calculateSubtotal(items: Item[]): number {
  return items.reduce((sum, item) => {
    const itemTotal = (item.price || 0) * (item.quantity || 1);
    return sum + itemTotal;
  }, 0);
}

/**
 * Calculate tax amount
 */
export function calculateTaxAmount(
  subtotal: number,
  taxValue: number,
  taxType: 'percentage' | 'fixed'
): number {
  if (taxType === 'percentage') {
    return (subtotal * taxValue) / 100;
  }
  return taxValue;
}

/**
 * Calculate service charge amount
 */
export function calculateServiceChargeAmount(
  subtotal: number,
  serviceChargeValue: number,
  serviceChargeType: 'percentage' | 'fixed'
): number {
  if (serviceChargeType === 'percentage') {
    return (subtotal * serviceChargeValue) / 100;
  }
  return serviceChargeValue;
}

/**
 * Calculate grand total
 * Formula: subtotal + tax + service charge
 */
export function calculateGrandTotal(
  subtotal: number,
  taxAmount: number,
  serviceChargeAmount: number
): number {
  return subtotal + taxAmount + serviceChargeAmount;
}

/**
 * Calculate EQUAL split
 * Total dibagi rata ke semua participant
 */
export function calculateEqualSplit(
  grandTotal: number,
  participants: Participant[]
): PaymentBreakdown[] {
  if (participants.length === 0) return [];

  const amountPerPerson = grandTotal / participants.length;

  return participants.map(participant => ({
    participantId: participant.id,
    participantName: participant.name,
    amount: parseFloat(amountPerPerson.toFixed(2)),
  }));
}

/**
 * ============================================================================
 * ITEM SPLIT CALCULATION - IMPROVED & SAFE FROM DOUBLE COUNTING
 * ============================================================================
 * 
 * Logic:
 * 1. Initialize all participant amounts to 0 (prevents accumulation)
 * 2. For each item: itemTotal = price × quantity
 * 3. Divide itemTotal by number of assigned participants
 * 4. Add share to each assigned participant
 * 5. Distribute tax/service charge based on item amounts
 * 
 * Safety mechanisms to prevent double counting:
 * - Fresh initialization: totals = {} resets before processing
 * - Single iteration: Each item processed exactly once
 * - Immutable pattern: No mutation of input arrays
 * - Validation: Check for empty assignedTo and division by zero
 * - Accumulation pattern: Use += to add (never overwrite)
 */

type ItemWithQuantity = Item & { 
  price: number; 
  quantity: number; 
  assignedTo: string[]; 
};

/**
 * Core function: Calculate item split amounts (items only, no tax/service)
 * Pure function - no side effects
 * 
 * @param items Array of items with assignedTo data
 * @param participants List of all participants
 * @returns Record of participantId -> item amount
 * @throws Error if item has empty assignedTo
 */
export function calculateItemAmounts(
  items: ItemWithQuantity[],
  participants: Participant[]
): Record<string, number> {
  // STEP 1: Initialize all participants with 0
  // This is critical - prevents double counting from previous calculations
  const itemAmounts: Record<string, number> = {};
  participants.forEach(p => {
    itemAmounts[p.id] = 0;
  });

  // STEP 2: Process each item exactly once (single iteration = no mutation issues)
  items.forEach(item => {
    // Validation: assignedTo must not be empty
    if (!item.assignedTo || item.assignedTo.length === 0) {
      throw new Error(
        `Item "${item.name}" has no assigned participants. ` +
        `Please assign at least one person or adjust the split method.`
      );
    }

    // Calculate item total: price × quantity
    const itemTotal = item.price * item.quantity;

    // Calculate share per assigned person
    const sharePerPerson = itemTotal / item.assignedTo.length;

    // Add share to each assigned participant
    // Using immutable accumulation pattern
    item.assignedTo.forEach(participantId => {
      itemAmounts[participantId] += sharePerPerson;
    });
  });

  return itemAmounts;
}

/**
 * Calculate ITEM split (including tax and service charge)
 * Setiap item dibagi hanya ke orang yang assign
 */
export function calculateItemSplit(
  items: Item[],
  participants: Participant[],
  grandTotal: number,
  taxAmount: number,
  serviceChargeAmount: number,
  subtotal: number
): PaymentBreakdown[] {
  try {
    // Get item amounts using pure function
    const itemAmounts = calculateItemAmounts(items as ItemWithQuantity[], participants);

    // Distribute tax and service charge proportionally to item amounts
    const totals: Record<string, number> = {};
    participants.forEach(p => {
      let amount = itemAmounts[p.id];

      // Add proportional share of tax and service charge
      if (subtotal > 0) {
        const proportion = itemAmounts[p.id] / subtotal;
        amount += taxAmount * proportion;
        amount += serviceChargeAmount * proportion;
      }

      // Round to 2 decimals to avoid floating point errors
      totals[p.id] = parseFloat(amount.toFixed(2));
    });

    // Return as PaymentBreakdown array
    return participants.map(participant => ({
      participantId: participant.id,
      participantName: participant.name,
      amount: totals[participant.id],
    }));
  } catch (error) {
    console.error('Item split calculation error:', error);
    return participants.map(p => ({
      participantId: p.id,
      participantName: p.name,
      amount: 0,
    }));
  }
}

/**
 * Calculate PERCENTAGE split
 * Setiap participant mengisi % berapa yang dibayar
 */
export function calculatePercentageSplit(
  grandTotal: number,
  participants: Participant[],
  percentages: Record<string, number>
): PaymentBreakdown[] {
  return participants.map(participant => ({
    participantId: participant.id,
    participantName: participant.name,
    percentage: percentages[participant.id] || 0,
    amount: parseFloat(((grandTotal * (percentages[participant.id] || 0)) / 100).toFixed(2)),
  }));
}

/**
 * Calculate CUSTOM split
 * Setiap participant input nominal langsung
 */
export function calculateCustomSplit(
  participants: Participant[],
  customAmounts: Record<string, number>
): PaymentBreakdown[] {
  return participants.map(participant => ({
    participantId: participant.id,
    participantName: participant.name,
    amount: parseFloat((customAmounts[participant.id] || 0).toFixed(2)),
  }));
}

/**
 * Main function to calculate split based on method
 * 
 * IMPORTANT: Must route to correct calculation based on splitMethod
 * Do NOT fallback to EQUAL unless explicitly selected
 */
export function calculateSplit(input: SplitCalculationInput): PaymentBreakdown[] {
  const {
    grandTotal,
    participants,
    items,
    taxAmount,
    serviceChargeAmount,
    splitMethod,
    percentages = {},
    customAmounts = {},
  } = input;

  // DEBUG: Log split method being used
  console.log('🔍 [calculateSplit] splitMethod:', splitMethod);
  console.log('🔍 [calculateSplit] participants count:', participants.length);
  console.log('🔍 [calculateSplit] items count:', items.length);
  console.log('🔍 [calculateSplit] grandTotal:', grandTotal);

  try {
    let result: PaymentBreakdown[];

    switch (splitMethod) {
      case 'EQUAL':
        console.log('✅ [calculateSplit] Using EQUAL split');
        result = calculateEqualSplit(grandTotal, participants);
        break;

      case 'ITEM':
        console.log('✅ [calculateSplit] Using ITEM split');
        result = calculateItemSplit(
          items,
          participants,
          grandTotal,
          taxAmount,
          serviceChargeAmount,
          grandTotal - taxAmount - serviceChargeAmount // subtotal
        );
        break;

      case 'PERCENTAGE':
        console.log('✅ [calculateSplit] Using PERCENTAGE split');
        result = calculatePercentageSplit(grandTotal, participants, percentages);
        break;

      case 'CUSTOM':
        console.log('✅ [calculateSplit] Using CUSTOM split');
        result = calculateCustomSplit(participants, customAmounts);
        break;

      default:
        console.warn('⚠️ [calculateSplit] UNKNOWN split method:', splitMethod);
        console.warn('⚠️ [calculateSplit] Defaulting to EQUAL split (WARNING: this should not happen!)');
        result = calculateEqualSplit(grandTotal, participants);
        break;
    }

    // Verify breakdown
    const breakdownTotal = result.reduce((sum, b) => sum + b.amount, 0);
    console.log('📊 [calculateSplit] Breakdown total:', breakdownTotal);
    console.log('📊 [calculateSplit] Expected total:', grandTotal);
    console.log('📊 [calculateSplit] Match:', Math.abs(breakdownTotal - grandTotal) < 0.01 ? '✓' : '✗');
    console.log('📊 [calculateSplit] Breakdown result:', result);

    return result;
  } catch (error) {
    console.error('❌ [calculateSplit] ERROR:', error);
    console.error('❌ [calculateSplit] Caught exception, returning empty breakdown');
    
    // Safety fallback: return breakdown with 0 amounts for all participants
    return participants.map(p => ({
      participantId: p.id,
      participantName: p.name,
      amount: 0,
    }));
  }
}

/**
 * Utility function to get total of breakdown
 */
export function getBreakdownTotal(breakdown: PaymentBreakdown[]): number {
  return parseFloat(
    breakdown.reduce((sum, item) => sum + item.amount, 0).toFixed(2)
  );
}

/**
 * Utility function to get items for specific participant (for item split)
 */
export function getItemsForParticipant(items: Item[], participantId: string): Item[] {
  return items.filter(item => {
    const assignedTo = item.assignedTo || [];
    return assignedTo.length === 0 || assignedTo.includes(participantId);
  });
}
