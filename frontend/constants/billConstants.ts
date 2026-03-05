/**
 * Constants untuk Create Bill feature
 * Terpusat untuk memudahkan perubahan dan maintenance
 */

export const CURRENCIES = [
  'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY',
  'INR', 'SGD', 'KRW', 'MXN', 'BRL', 'THB', 'IDR', 'MYR'
] as const;

export const DEFAULT_CURRENCY = 'USD' as const;
export const DEFAULT_QUANTITY = 1;
export const DEFAULT_TAX_TYPE = 'percentage' as const;
export const DEFAULT_SPLIT_METHOD = 'equal' as const;

// Validation rules
export const VALIDATION_RULES = {
  title: {
    minLength: 1,
    maxLength: 200,
    required: true,
  },
  itemName: {
    minLength: 1,
    maxLength: 256,
    required: true,
  },
  itemPrice: {
    min: 0.01,
    max: 1000000,
    required: true,
  },
  itemQuantity: {
    min: 1,
    max: 1000,
    default: DEFAULT_QUANTITY,
  },
  participantName: {
    minLength: 1,
    maxLength: 100,
    required: true,
  },
  taxValue: {
    min: 0,
    max: 100000,
    default: 0,
  },
  serviceCharge: {
    min: 0,
    max: 100000,
    default: 0,
  },
} as const;

// Form steps
export const BILL_FORM_STEPS = {
  DETAILS: 0,
  ITEMS: 1,
  PARTICIPANTS: 2,
  REVIEW: 3,
} as const;

export const STEP_LABELS = {
  [BILL_FORM_STEPS.DETAILS]: 'Bill Details',
  [BILL_FORM_STEPS.ITEMS]: 'Add Items',
  [BILL_FORM_STEPS.PARTICIPANTS]: 'Add People',
  [BILL_FORM_STEPS.REVIEW]: 'Review & Create',
} as const;

// Split methods
export const SPLIT_METHODS = ['equal', 'per_item', 'percentage', 'custom'] as const;

// Tax types
export const TAX_TYPES = ['percentage', 'fixed'] as const;
