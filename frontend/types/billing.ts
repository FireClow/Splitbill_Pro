/**
 * Types and Data Models for Split Bill Flow
 * File: frontend/types/billing.ts
 */

export type InputMethod = 'MANUAL' | 'PHOTO';
export type SplitMethod = 'EQUAL' | 'ITEM' | 'PERCENTAGE' | 'CUSTOM';

/**
 * Participant in a bill
 */
export interface Participant {
  id: string;
  name: string;
}

/**
 * Item/Product in a bill
 */
export interface Item {
  id: string;
  name: string;
  price: number;
  quantity: number;
  assignedTo?: string[]; // Only for ITEM split method
}

/**
 * Payment breakdown for a participant
 */
export interface PaymentBreakdown {
  participantId: string;
  participantName: string;
  amount: number;
  percentage?: number;
}

/**
 * Complete Bill structure
 */
export interface Bill {
  id: string;
  title: string;
  currency: string;
  inputMethod: InputMethod;
  splitMethod: SplitMethod;
  
  // Amounts
  subtotal: number;
  taxAmount: number;
  taxType: 'percentage' | 'fixed'; // Added for flexibility
  taxValue: number;
  serviceChargeAmount: number;
  serviceChargeType: 'percentage' | 'fixed'; // Added for flexibility
  serviceChargeValue: number;
  grandTotal: number;
  
  // Data
  participants: Participant[];
  items: Item[];
  breakdown: PaymentBreakdown[];
  
  // Metadata
  isPaid: boolean;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Form state untuk create bill flow
 */
export interface CreateBillFormState {
  // Step 2: Basic Info
  title: string;
  currency: string;
  inputMethod: InputMethod;
  
  // Step 3: Bill Details
  items: Item[];
  taxValue: number;
  taxType: 'percentage' | 'fixed';
  serviceChargeValue: number;
  serviceChargeType: 'percentage' | 'fixed';
  
  // Step 4: Participants
  participants: Participant[];
  
  // Step 5: Split Method + Details
  splitMethod: SplitMethod;
  percentages?: Record<string, number>; // For PERCENTAGE split
  customAmounts?: Record<string, number>; // For CUSTOM split
  
  // Calculated
  subtotal: number;
  taxAmount: number;
  serviceChargeAmount: number;
  grandTotal: number;
  breakdown: PaymentBreakdown[];
}

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

/**
 * Split calculation input
 */
export interface SplitCalculationInput {
  grandTotal: number;
  participants: Participant[];
  items: Item[];
  taxAmount: number;
  serviceChargeAmount: number;
  splitMethod: SplitMethod;
  percentages?: Record<string, number>; // For percentage split
  customAmounts?: Record<string, number>; // For custom split
}
