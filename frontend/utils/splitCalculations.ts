/**
 * Business Logic Layer - Calculation Functions
 * File: frontend/utils/billCalculations.ts
 * 
 * All calculation functions for different split methods
 * Pure functions - no side effects
 */

import { Item, Participant, PaymentBreakdown, SplitCalculationInput } from '../types/billing';
import { getNormalizedItemAssignments } from './itemAssignments';

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function distributeProportionally(
  baseAmounts: Record<string, number>,
  totalToDistribute: number,
  participantIds: string[]
): Record<string, number> {
  const distributed: Record<string, number> = {};
  participantIds.forEach(id => {
    distributed[id] = 0;
  });

  const baseTotal = participantIds.reduce((sum, id) => sum + (baseAmounts[id] || 0), 0);
  if (participantIds.length === 0 || totalToDistribute === 0) {
    return distributed;
  }

  if (baseTotal <= 0) {
    const equalShare = totalToDistribute / participantIds.length;
    participantIds.forEach(id => {
      distributed[id] = round2(equalShare);
    });
    const roundedTotal = participantIds.reduce((sum, id) => sum + distributed[id], 0);
    const diff = round2(totalToDistribute - roundedTotal);
    if (Math.abs(diff) >= 0.01 && participantIds[0]) {
      distributed[participantIds[0]] = round2(distributed[participantIds[0]] + diff);
    }
    return distributed;
  }

  const rawShares = participantIds.map(id => {
    const share = ((baseAmounts[id] || 0) / baseTotal) * totalToDistribute;
    const roundedShare = round2(share);
    return { id, share, roundedShare, remainder: share - roundedShare };
  });

  rawShares.forEach(item => {
    distributed[item.id] = item.roundedShare;
  });

  const roundedTotal = rawShares.reduce((sum, item) => sum + item.roundedShare, 0);
  let diffInCents = Math.round((totalToDistribute - roundedTotal) * 100);
  if (diffInCents === 0) {
    return distributed;
  }

  const sorted = [...rawShares].sort((a, b) => {
    return diffInCents > 0 ? b.remainder - a.remainder : a.remainder - b.remainder;
  });

  let idx = 0;
  while (diffInCents !== 0 && sorted.length > 0) {
    const target = sorted[idx % sorted.length].id;
    distributed[target] = round2(distributed[target] + (diffInCents > 0 ? 0.01 : -0.01));
    diffInCents += diffInCents > 0 ? -1 : 1;
    idx += 1;
  }

  return distributed;
}

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

export function calculateDiscountAmount(
  subtotal: number,
  discountValue: number,
  discountType: 'percentage' | 'fixed'
): number {
  if (discountType === 'percentage') {
    return (subtotal * discountValue) / 100;
  }
  return discountValue;
}

/**
 * Calculate grand total
 * Formula: subtotal + tax + service charge
 */
export function calculateGrandTotal(
  subtotal: number,
  taxAmount: number,
  serviceChargeAmount: number,
  discountAmount = 0
): number {
  return subtotal + taxAmount + serviceChargeAmount - discountAmount;
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
  assignedTo?: string[];
  assignedQuantities?: Record<string, number>;
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
    const assignment = getNormalizedItemAssignments(item);
    const participantIds = Object.keys(assignment);

    if (participantIds.length === 0) {
      throw new Error(
        `Item "${item.name}" has no valid quantity assignments. ` +
        `Assign item quantity to at least one person.`
      );
    }

    const assignedQtyTotal = participantIds.reduce((sum, id) => sum + assignment[id], 0);
    if (assignedQtyTotal > item.quantity) {
      throw new Error(
        `Item "${item.name}" assigned quantity (${assignedQtyTotal}) exceeds item quantity (${item.quantity}).`
      );
    }
    if (assignedQtyTotal <= 0) {
      throw new Error(`Item "${item.name}" assigned quantity must be greater than zero.`);
    }

    const unitPrice = item.quantity > 0 ? item.price : 0;
    participantIds.forEach(participantId => {
      if (!(participantId in itemAmounts)) {
        throw new Error(`Participant "${participantId}" not found for item "${item.name}".`);
      }
      const participantAmount = unitPrice * assignment[participantId];
      itemAmounts[participantId] += participantAmount;
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
  _grandTotal: number,
  taxAmount: number,
  serviceChargeAmount: number,
  subtotal: number,
  tipAmount = 0,
  discountAmount = 0
): PaymentBreakdown[] {
  try {
    // Get item amounts using pure function
    const itemAmounts = calculateItemAmounts(items as ItemWithQuantity[], participants);

    // Distribute tax and service charge proportionally to item amounts
    const participantIds = participants.map(p => p.id);
    const effectiveSubtotal = subtotal > 0
      ? subtotal
      : participantIds.reduce((sum, id) => sum + (itemAmounts[id] || 0), 0);

    const taxShares = distributeProportionally(itemAmounts, taxAmount, participantIds);
    const serviceShares = distributeProportionally(itemAmounts, serviceChargeAmount, participantIds);
    const tipShares = distributeProportionally(itemAmounts, tipAmount, participantIds);
    const discountShares = distributeProportionally(itemAmounts, discountAmount, participantIds);

    const totals: Record<string, number> = {};
    participants.forEach(p => {
      const personSubtotal = itemAmounts[p.id] || 0;
      const amount = personSubtotal
        + (taxShares[p.id] || 0)
        + (serviceShares[p.id] || 0)
        + (tipShares[p.id] || 0)
        - (discountShares[p.id] || 0);

      totals[p.id] = round2(amount);
    });

    const expectedTotal = round2(effectiveSubtotal + taxAmount + serviceChargeAmount + tipAmount - discountAmount);
    const currentTotal = round2(Object.values(totals).reduce((sum, value) => sum + value, 0));
    const diff = round2(expectedTotal - currentTotal);
    if (Math.abs(diff) >= 0.01 && participantIds[0]) {
      totals[participantIds[0]] = round2(totals[participantIds[0]] + diff);
    }

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
    tipAmount = 0,
    discountAmount = 0,
    splitMethod,
    percentages = {},
    customAmounts = {},
  } = input;

  try {
    let result: PaymentBreakdown[];

    switch (splitMethod) {
      case 'EQUAL':
        result = calculateEqualSplit(grandTotal, participants);
        break;

      case 'ITEM':
        result = calculateItemSplit(
          items,
          participants,
          grandTotal,
          taxAmount,
          serviceChargeAmount,
          grandTotal - taxAmount - serviceChargeAmount + discountAmount - tipAmount,
          tipAmount,
          discountAmount
        );
        break;

      case 'PERCENTAGE':
        result = calculatePercentageSplit(grandTotal, participants, percentages);
        break;

      case 'CUSTOM':
        result = calculateCustomSplit(participants, customAmounts);
        break;

      default:
        result = calculateEqualSplit(grandTotal, participants);
        break;
    }

    return result;
  } catch (error) {
    console.error('Split calculation error:', error);

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
    const assignedQuantities = item.assignedQuantities || {};
    if (Object.keys(assignedQuantities).length > 0) {
      return (assignedQuantities[participantId] || 0) > 0;
    }
    const assignedTo = item.assignedTo || [];
    return assignedTo.includes(participantId);
  });
}
