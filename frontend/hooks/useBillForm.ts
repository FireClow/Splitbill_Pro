/**
 * Custom hook untuk manage Bill Form state
 * Mengekstrak logic dari main component untuk reusability dan clarity
 */

import { useState, useCallback, useEffect } from 'react';
import { ItemDraft, ParticipantDraft, ReceiptData } from '../types/bill';
import {
  DEFAULT_CURRENCY,
  DEFAULT_QUANTITY,
  DEFAULT_TAX_TYPE,
  DEFAULT_SPLIT_METHOD,
} from '../constants/billConstants';

export const useBillForm = (initialReceiptData?: ReceiptData) => {
  // Form state
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState('');
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [items, setItems] = useState<ItemDraft[]>([{ name: '', price: '', quantity: '1' }]);
  const [participants, setParticipants] = useState<ParticipantDraft[]>([]);
  const [newParticipantName, setNewParticipantName] = useState('');
  const [taxType, setTaxType] = useState<'percentage' | 'fixed'>(DEFAULT_TAX_TYPE);
  const [taxValue, setTaxValue] = useState('');
  const [serviceCharge, setServiceCharge] = useState('');
  const [splitMethod, setSplitMethod] = useState(DEFAULT_SPLIT_METHOD);
  const [receiptImageId, setReceiptImageId] = useState<string | null>(null);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize with receipt data jika provided
  useEffect(() => {
    if (initialReceiptData) {
      loadReceiptData(initialReceiptData);
    }
  }, [initialReceiptData]);

  /**
   * Load receipt data ke form
   */
  const loadReceiptData = useCallback((data: ReceiptData) => {
    if (data.items?.length) {
      setItems(
        data.items.map((item) => ({
          name: item.name,
          price: item.price.toString(),
          quantity: item.quantity.toString(),
        }))
      );
    }

    if (data.currency) {
      setCurrency(data.currency);
    }

    if (data.tax) {
      setTaxValue(data.tax.toString());
    }

    if (data.service_charge) {
      setServiceCharge(data.service_charge.toString());
    }

    if (data.image_id) {
      setReceiptImageId(data.image_id);
    }
  }, []);

  // ──────────── Item Management ────────────

  const addItem = useCallback(() => {
    setItems((prev) => [
      ...prev,
      { name: '', price: '', quantity: DEFAULT_QUANTITY.toString() },
    ]);
  }, []);

  const removeItem = useCallback((index: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  }, []);

  const updateItem = useCallback(
    (index: number, field: keyof ItemDraft, value: string) => {
      setItems((prev) => {
        const updated = [...prev];
        updated[index] = { ...updated[index], [field]: value };
        return updated;
      });
    },
    []
  );

  // ──────────── Participant Management ────────────

  const addParticipant = useCallback(() => {
    if (!newParticipantName.trim()) return;

    setParticipants((prev) => [
      ...prev,
      { name: newParticipantName.trim(), contact_info: '' },
    ]);
    setNewParticipantName('');
  }, [newParticipantName]);

  const removeParticipant = useCallback((index: number) => {
    setParticipants((prev) => prev.filter((_, idx) => idx !== index));
  }, []);

  // ──────────── Step Navigation ────────────

  const goToStep = useCallback((newStep: number) => {
    setStep(newStep);
  }, []);

  const nextStep = useCallback(() => {
    setStep((prev) => prev + 1);
  }, []);

  const prevStep = useCallback(() => {
    setStep((prev) => Math.max(0, prev - 1));
  }, []);

  // ──────────── Reset ────────────

  const resetForm = useCallback(() => {
    setStep(0);
    setTitle('');
    setCurrency(DEFAULT_CURRENCY);
    setItems([{ name: '', price: '', quantity: '1' }]);
    setParticipants([]);
    setNewParticipantName('');
    setTaxType(DEFAULT_TAX_TYPE);
    setTaxValue('');
    setServiceCharge('');
    setSplitMethod(DEFAULT_SPLIT_METHOD);
    setReceiptImageId(null);
    setShowCurrencyPicker(false);
    setIsSaving(false);
  }, []);

  return {
    // State
    step,
    title,
    currency,
    items,
    participants,
    newParticipantName,
    taxType,
    taxValue,
    serviceCharge,
    splitMethod,
    receiptImageId,
    showCurrencyPicker,
    isSaving,

    // Setters
    setTitle,
    setCurrency,
    setItems,
    setParticipants,
    setNewParticipantName,
    setTaxType,
    setTaxValue,
    setServiceCharge,
    setSplitMethod,
    setReceiptImageId,
    setShowCurrencyPicker,
    setIsSaving,

    // Actions
    addItem,
    removeItem,
    updateItem,
    addParticipant,
    removeParticipant,
    goToStep,
    nextStep,
    prevStep,
    resetForm,
    loadReceiptData,
  };
};
