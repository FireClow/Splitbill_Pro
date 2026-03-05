/**
 * Validation utilities untuk form Bill
 * Centralized logic untuk validate setiap step dan field
 */

import { ItemDraft, ParticipantDraft } from '../types/bill';
import { VALIDATION_RULES } from '../constants/billConstants';

/**
 * Validate bill title
 * @param title - Bill title
 * @returns Error message jika invalid, null jika valid
 */
export const validateTitle = (title: string): string | null => {
  if (!title.trim()) {
    return 'Please enter a bill title';
  }
  if (title.length > VALIDATION_RULES.title.maxLength) {
    return `Title cannot exceed ${VALIDATION_RULES.title.maxLength} characters`;
  }
  return null;
};

/**
 * Validate items list
 * @param items - Array of items
 * @returns Error message jika invalid, null jika valid
 */
export const validateItems = (items: ItemDraft[]): string | null => {
  const validItems = items.filter(
    (item) => item.name.trim() && parseFloat(item.price) > 0
  );

  if (validItems.length === 0) {
    return 'Please add at least one item with name and price';
  }

  // Check individual items
  for (const item of validItems) {
    if (item.name.length > VALIDATION_RULES.itemName.maxLength) {
      return `Item name cannot exceed ${VALIDATION_RULES.itemName.maxLength} characters`;
    }
    const price = parseFloat(item.price);
    if (price < VALIDATION_RULES.itemPrice.min || price > VALIDATION_RULES.itemPrice.max) {
      return `Item price must be between ${VALIDATION_RULES.itemPrice.min} and ${VALIDATION_RULES.itemPrice.max}`;
    }
  }

  return null;
};

/**
 * Validate participants list
 * @param participants - Array of participants
 * @returns Error message jika invalid, null jika valid
 */
export const validateParticipants = (participants: ParticipantDraft[]): string | null => {
  if (participants.length === 0) {
    return 'Please add at least one person (including yourself)';
  }

  for (const participant of participants) {
    if (participant.name.length > VALIDATION_RULES.participantName.maxLength) {
      return `Participant name cannot exceed ${VALIDATION_RULES.participantName.maxLength} characters`;
    }
  }

  return null;
};

/**
 * Validate entire step based on step number
 * @param step - Current step number
 * @param formData - Form data to validate
 * @returns Error message jika step invalid, null jika valid
 */
export const validateStep = (
  step: number,
  formData: {
    title: string;
    items: ItemDraft[];
    participants: ParticipantDraft[];
  }
): string | null => {
  switch (step) {
    case 0: // Details step
      return validateTitle(formData.title);
    case 1: // Items step
      return validateItems(formData.items);
    case 2: // Participants step
      return validateParticipants(formData.participants);
    default:
      return null;
  }
};

/**
 * Get valid items (filter out empty/invalid ones)
 * @param items - Array of items to filter
 * @returns Filtered array of valid items
 */
export const getValidItems = (items: ItemDraft[]): ItemDraft[] => {
  return items.filter((item) => item.name.trim() && parseFloat(item.price) > 0);
};

/**
 * Check if user's own name is in participants list
 * @param userName - User's name
 * @param participants - List of participants
 * @returns true jika nama user ada di list
 */
export const isUserNameInParticipants = (
  userName: string | undefined,
  participants: ParticipantDraft[]
): boolean => {
  if (!userName) return false;
  return participants.some(
    (p) => p.name.toLowerCase() === userName.toLowerCase()
  );
};
