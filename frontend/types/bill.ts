/**
 * Type definitions untuk Bill/Create Bill feature
 */

export interface ItemDraft {
  name: string;
  price: string;
  quantity: string;
}

export interface ParticipantDraft {
  name: string;
  contact_info: string;
}

export interface ReceiptData {
  items?: Array<{
    name: string;
    price: number | string;
    quantity: number | string;
  }>;
  currency?: string;
  tax?: number | string;
  service_charge?: number | string;
  image_id?: string;
}

export interface BillFormState {
  step: number;
  title: string;
  currency: string;
  items: ItemDraft[];
  participants: ParticipantDraft[];
  taxType: 'percentage' | 'fixed';
  taxValue: string;
  serviceCharge: string;
  splitMethod: string;
  receiptImageId: string | null;
  isSaving: boolean;
  showCurrencyPicker: boolean;
}

export interface BillReviewData {
  title: string;
  currency: string;
  items: ItemDraft[];
  participants: ParticipantDraft[];
  subtotal: number;
  taxAmount: number;
  total: number;
  splitMethod: string;
}

export interface CreateBillPayload {
  title: string;
  currency: string;
  items: Array<{
    name: string;
    price: number;
    quantity: number;
    assigned_to: string[];
  }>;
  participants: Array<{
    name: string;
    contact_info: string;
  }>;
  tax_type: 'percentage' | 'fixed';
  tax_value: number;
  service_charge: number;
  split_method: string;
  receipt_image_id?: string | null;
}
