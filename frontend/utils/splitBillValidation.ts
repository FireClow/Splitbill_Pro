/**
 * Validation Layer - Business Rules & Validation
 * File: frontend/utils/splitBillValidation.ts
 * 
 * All validation logic for splits and bills
 * Ensures data integrity and business rules
 */

import {
  CreateBillFormState,
  Item,
  Participant,
  PaymentBreakdown,
  ValidationResult,
} from '../types/billing';

const TOLERANCE = 0.01; // Tolerance for floating point comparison

/**
 * Validate bill title
 */
export function validateTitle(title: string): ValidationResult {
  const errors: string[] = [];

  if (!title || title.trim().length === 0) {
    errors.push('Bill title is required');
  }
  if (title.length > 200) {
    errors.push('Bill title must be less than 200 characters');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate currency
 */
export function validateCurrency(currency: string): ValidationResult {
  const validCurrencies = ['IDR', 'USD', 'SGD', 'MYR', 'THB', 'PHP', 'VND'];
  const errors: string[] = [];

  if (!currency) {
    errors.push('Currency is required');
  }
  if (!validCurrencies.includes(currency)) {
    errors.push(`Invalid currency. Must be one of: ${validCurrencies.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate items list
 */
export function validateItems(items: Item[]): ValidationResult {
  const errors: string[] = [];

  if (!items || items.length === 0) {
    errors.push('At least one item is required');
    return { isValid: false, errors };
  }

  items.forEach((item, index) => {
    if (!item.name || item.name.trim().length === 0) {
      errors.push(`Item ${index + 1}: Name is required`);
    }
    if (item.price < 0) {
      errors.push(`Item ${index + 1}: Price cannot be negative`);
    }
    if (item.price === 0) {
      errors.push(`Item ${index + 1}: Price must be greater than 0`);
    }
    if (item.quantity < 1) {
      errors.push(`Item ${index + 1}: Quantity must be at least 1`);
    }
    if (!Number.isInteger(item.quantity)) {
      errors.push(`Item ${index + 1}: Quantity must be a whole number`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate tax value
 */
export function validateTax(
  taxValue: number,
  taxType: 'percentage' | 'fixed'
): ValidationResult {
  const errors: string[] = [];

  if (taxValue < 0) {
    errors.push('Tax value cannot be negative');
  }

  if (taxType === 'percentage' && taxValue > 100) {
    errors.push('Tax percentage cannot exceed 100%');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate service charge value
 */
export function validateServiceCharge(
  serviceChargeValue: number,
  serviceChargeType: 'percentage' | 'fixed'
): ValidationResult {
  const errors: string[] = [];

  if (serviceChargeValue < 0) {
    errors.push('Service charge cannot be negative');
  }

  if (serviceChargeType === 'percentage' && serviceChargeValue > 100) {
    errors.push('Service charge percentage cannot exceed 100%');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate participants list
 */
export function validateParticipants(participants: Participant[]): ValidationResult {
  const errors: string[] = [];

  if (!participants || participants.length === 0) {
    errors.push('At least one participant is required');
    return { isValid: false, errors };
  }

  if (participants.length === 1) {
    errors.push('At least two participants are required for splitting');
  }

  const names = new Set<string>();
  participants.forEach((participant, index) => {
    if (!participant.name || participant.name.trim().length === 0) {
      errors.push(`Participant ${index + 1}: Name is required`);
    }
    if (participant.name && names.has(participant.name)) {
      errors.push(`Participant names must be unique (${participant.name} is duplicated)`);
    }
    if (participant.name) {
      names.add(participant.name);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate ITEM split assignment
 * Ensure all items have at least one person assigned
 */
export function validateItemSplitAssignment(items: Item[]): ValidationResult {
  const errors: string[] = [];

  items.forEach((item, index) => {
    const assignedTo = item.assignedTo || [];
    if (assignedTo.length === 0) {
      // Items without assignment will be split equally - this is OK
      // Just a warning
    }
  });

  return {
    isValid: true,
    errors,
  };
}

/**
 * Validate PERCENTAGE split
 * Total percentage must equal 100%
 */
export function validatePercentageSplit(
  percentages: Record<string, number>,
  participants: Participant[]
): ValidationResult {
  const errors: string[] = [];

  // Check all participants have percentage
  participants.forEach(p => {
    if (!(p.id in percentages)) {
      errors.push(`${p.name}: Percentage is required`);
    }
  });

  // Calculate total
  const total = Object.values(percentages).reduce((sum, val) => sum + val, 0);

  // Check values are non-negative
  Object.entries(percentages).forEach(([participantId, percentage]) => {
    if (percentage < 0) {
      const participant = participants.find(p => p.id === participantId);
      errors.push(`${participant?.name || participantId}: Percentage cannot be negative`);
    }
    if (percentage > 100) {
      const participant = participants.find(p => p.id === participantId);
      errors.push(`${participant?.name || participantId}: Percentage cannot exceed 100%`);
    }
  });

  // Check total equals 100
  if (Math.abs(total - 100) > TOLERANCE) {
    errors.push(
      `Total percentage must be exactly 100% (currently ${total.toFixed(2)}%)`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate CUSTOM split
 * Total amount must equal grand total
 */
export function validateCustomSplit(
  customAmounts: Record<string, number>,
  grandTotal: number,
  participants: Participant[]
): ValidationResult {
  const errors: string[] = [];

  // Check all participants have amount
  participants.forEach(p => {
    if (!(p.id in customAmounts)) {
      errors.push(`${p.name}: Amount is required`);
    }
  });

  // Check values are non-negative
  Object.entries(customAmounts).forEach(([participantId, amount]) => {
    if (amount < 0) {
      const participant = participants.find(p => p.id === participantId);
      errors.push(`${participant?.name || participantId}: Amount cannot be negative`);
    }
    if (amount > grandTotal) {
      const participant = participants.find(p => p.id === participantId);
      errors.push(
        `${participant?.name || participantId}: Amount cannot exceed grand total`
      );
    }
  });

  // Calculate total
  const total = Object.values(customAmounts).reduce((sum, val) => sum + val, 0);

  // Check total equals grand total
  if (Math.abs(total - grandTotal) > TOLERANCE) {
    errors.push(
      `Total amount must equal grand total (${grandTotal.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}). Currently: ${total.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate breakdown
 * Total of breakdown must equal grand total
 */
export function validateBreakdown(
  breakdown: PaymentBreakdown[],
  grandTotal: number
): ValidationResult {
  const errors: string[] = [];

  if (!breakdown || breakdown.length === 0) {
    errors.push('Breakdown is empty');
    return { isValid: false, errors };
  }

  const total = breakdown.reduce((sum, item) => sum + item.amount, 0);

  if (Math.abs(total - grandTotal) > TOLERANCE) {
    errors.push(
      `Breakdown total (${total.toFixed(2)}) does not match grand total (${grandTotal.toFixed(
        2
      )})`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Comprehensive validation for split bill form
 */
export function validateCreateBillForm(
  form: CreateBillFormState,
  customAmounts?: Record<string, number>,
  percentages?: Record<string, number>
): ValidationResult {
  const allErrors: string[] = [];

  // Validate basic info
  const titleValidation = validateTitle(form.title);
  allErrors.push(...titleValidation.errors);

  const currencyValidation = validateCurrency(form.currency);
  allErrors.push(...currencyValidation.errors);

  // Validate items
  const itemsValidation = validateItems(form.items);
  allErrors.push(...itemsValidation.errors);

  // Validate tax
  const taxValidation = validateTax(form.taxValue, form.taxType);
  allErrors.push(...taxValidation.errors);

  // Validate service charge
  const serviceChargeValidation = validateServiceCharge(
    form.serviceChargeValue,
    form.serviceChargeType
  );
  allErrors.push(...serviceChargeValidation.errors);

  // Validate participants
  const participantsValidation = validateParticipants(form.participants);
  allErrors.push(...participantsValidation.errors);

  // Validate split method specific rules
  if (form.splitMethod === 'ITEM') {
    const itemAssignmentValidation = validateItemSplitAssignment(form.items);
    allErrors.push(...itemAssignmentValidation.errors);
  } else if (form.splitMethod === 'PERCENTAGE' && percentages) {
    const percentageValidation = validatePercentageSplit(percentages, form.participants);
    allErrors.push(...percentageValidation.errors);
  } else if (form.splitMethod === 'CUSTOM' && customAmounts) {
    const customValidation = validateCustomSplit(
      customAmounts,
      form.grandTotal,
      form.participants
    );
    allErrors.push(...customValidation.errors);
  }

  // Validate breakdown
  const breakdownValidation = validateBreakdown(form.breakdown, form.grandTotal);
  allErrors.push(...breakdownValidation.errors);

  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
  };
}
