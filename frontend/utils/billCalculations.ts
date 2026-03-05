/**
 * Calculation utilities untuk Bill
 * Helper functions untuk compute totals, taxes, formatting, etc
 */

import { ItemDraft } from '../types/bill';

/**
 * Format number sebagai currency dengan thousand separators
 * @param amount - Amount to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string
 */
export const formatCurrency = (
  amount: number,
  decimals: number = 2
): string => {
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

/**
 * Calculate subtotal dari items
 * @param items - Array of items
 * @returns Subtotal amount
 */
export const calculateSubtotal = (items: ItemDraft[]): number => {
  return items.reduce((sum, item) => {
    const price = parseFloat(item.price) || 0;
    const quantity = parseInt(item.quantity) || 1;
    return sum + price * quantity;
  }, 0);
};

/**
 * Calculate tax amount
 * @param subtotal - Subtotal amount
 * @param taxType - 'percentage' atau 'fixed'
 * @param taxValue - Tax value (percentage atau fixed amount)
 * @returns Tax amount
 */
export const calculateTax = (
  subtotal: number,
  taxType: 'percentage' | 'fixed',
  taxValue: string
): number => {
  const value = parseFloat(taxValue) || 0;
  
  if (taxType === 'percentage') {
    return subtotal * (value / 100);
  }
  
  return value; // fixed amount
};

/**
 * Calculate total dengan tax dan service charge
 * @param subtotal - Subtotal
 * @param taxAmount - Tax amount
 * @param serviceCharge - Service charge amount
 * @returns Total amount
 */
export const calculateTotal = (
  subtotal: number,
  taxAmount: number,
  serviceCharge: string
): number => {
  const charge = parseFloat(serviceCharge) || 0;
  return subtotal + taxAmount + charge;
};

/**
 * Format currency value with auto-detection
 * Helps user input dengan proper formatting
 * @param value - Currency value string
 * @returns Formatted value
 */
export const formatCurrencyInput = (value: string): string => {
  // Remove non-numeric characters except decimal point
  const cleaned = value.replace(/[^0-9.]/g, '');
  
  // Ensure only one decimal point
  const parts = cleaned.split('.');
  if (parts.length > 2) {
    return parts[0] + '.' + parts.slice(1).join('');
  }
  
  return cleaned;
};

/**
 * Round amount to 2 decimal places
 * @param amount - Amount to round
 * @returns Rounded amount
 */
export const roundAmount = (amount: number): number => {
  return Math.round(amount * 100) / 100;
};

/**
 * Calculate per-person split untuk equal split method
 * @param total - Total amount
 * @param participantCount - Number of participants
 * @returns Per-person amount
 */
export const calculatePerPersonAmount = (
  total: number,
  participantCount: number
): number => {
  if (participantCount === 0) return 0;
  return roundAmount(total / participantCount);
};

/**
 * Check if number is valid currency amount
 * @param value - Value to check
 * @returns true jika valid currency amount
 */
export const isValidCurrencyAmount = (value: string): boolean => {
  const num = parseFloat(value);
  return !isNaN(num) && num >= 0;
};
