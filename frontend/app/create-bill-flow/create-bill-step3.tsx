/**
 * Step 3: Bill Details
 * File: frontend/app/(tabs)/create-bill-step3.tsx
 * 
 * User adds:
 * - Items (name, price, quantity) with real-time calculation
 * - Tax (amount or percentage)
 * - Service charge (amount or percentage)
 * - Real-time display of subtotal, tax, service charge, and grand total
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
} from 'react-native';
import { useSplitBill } from '../../contexts/SplitBillContext';
import { validateItems, validateTax, validateServiceCharge } from '../../utils/splitBillValidation';

interface Step3Props {
  onNext: () => void;
  onPrevious: () => void;
}

interface ItemInput {
  name: string;
  price: string;
  quantity: string;
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const Step3BillDetails: React.FC<Step3Props> = ({ onNext, onPrevious }) => {
  const { form, addItem, removeItem, setTax, setServiceCharge } = useSplitBill();
  const [itemInput, setItemInput] = useState<ItemInput>({ name: '', price: '', quantity: '' });
  const [itemError, setItemError] = useState('');
  const [showAddItemModal, setShowAddItemModal] = useState(false);

  const [taxValue, setTaxValue] = useState(form.taxValue.toString());
  const [taxType, setTaxType] = useState<'percentage' | 'fixed'>(form.taxType);
  const [taxError, setTaxError] = useState('');

  const [serviceChargeValue, setServiceChargeValue] = useState(
    form.serviceChargeValue.toString()
  );
  const [serviceChargeType, setServiceChargeType] = useState<'percentage' | 'fixed'>(
    form.serviceChargeType
  );
  const [serviceChargeError, setServiceChargeError] = useState('');

  const handleAddItem = () => {
    const { name, price, quantity } = itemInput;
    
    if (!name || !price || !quantity) {
      setItemError('All fields are required');
      return;
    }

    const numPrice = parseFloat(price);
    const numQuantity = parseInt(quantity, 10);

    // Validate
    const itemsToValidate = [{
      id: 'temp',
      name,
      price: numPrice,
      quantity: numQuantity,
      assignedTo: [],
    }];

    const validation = validateItems(itemsToValidate);
    if (!validation.valid) {
      setItemError(validation.error || 'Invalid item');
      return;
    }

    addItem({
      name,
      price: numPrice,
      quantity: numQuantity,
      assignedTo: [],
    });

    setItemInput({ name: '', price: '', quantity: '' });
    setItemError('');
    setShowAddItemModal(false);
  };

  const handleTaxChange = (text: string) => {
    setTaxValue(text);
    setTaxError('');
  };

  const handleUpdateTax = () => {
    const value = parseFloat(taxValue) || 0;
    const validation = validateTax({ value, type: taxType });
    if (!validation.valid) {
      setTaxError(validation.error || 'Invalid tax');
      return;
    }
    setTax(value, taxType);
    setTaxError('');
  };

  const handleServiceChargeChange = (text: string) => {
    setServiceChargeValue(text);
    setServiceChargeError('');
  };

  const handleUpdateServiceCharge = () => {
    const value = parseFloat(serviceChargeValue) || 0;
    const validation = validateServiceCharge({ value, type: serviceChargeType });
    if (!validation.valid) {
      setServiceChargeError(validation.error || 'Invalid service charge');
      return;
    }
    setServiceCharge(value, serviceChargeType);
    setServiceChargeError('');
  };

  const handleNext = () => {
    if (form.items.length === 0) {
      setItemError('Add at least one item');
      return;
    }
    onNext();
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.stepNumber}>Step 3 of 6</Text>
        <Text style={styles.title}>Bill Details</Text>
        <Text style={styles.subtitle}>Add items, tax, and service charge</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Items Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Items *</Text>
            <Text style={styles.itemCount}>{form.items.length} item(s)</Text>
          </View>

          {form.items.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateIcon}>📋</Text>
              <Text style={styles.emptyStateText}>No items yet</Text>
              <Text style={styles.emptyStateSubtext}>Add items to get started</Text>
            </View>
          ) : (
            <View>
              {form.items.map(item => (
                <View key={item.id} style={styles.itemCard}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemDetails}>
                      {formatCurrency(item.price)} × {item.quantity} ={' '}
                      {formatCurrency(item.price * item.quantity)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => removeItem(item.id)}
                  >
                    <Text style={styles.removeButtonText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowAddItemModal(true)}
          >
            <Text style={styles.addButtonText}>+ Add Item</Text>
          </TouchableOpacity>

          {itemError && <Text style={styles.errorText}>{itemError}</Text>}
        </View>

        {/* Subtotal Display */}
        {form.items.length > 0 && (
          <View style={styles.calculationBox}>
            <View style={styles.calculationRow}>
              <Text style={styles.calculationLabel}>Subtotal</Text>
              <Text style={styles.calculationValue}>
                {formatCurrency(form.subtotal)}
              </Text>
            </View>
          </View>
        )}

        {/* Tax Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tax</Text>
          <View style={styles.taxServiceContainer}>
            <TextInput
              style={styles.taxServiceInput}
              placeholder="0"
              placeholderTextColor="#ccc"
              keyboardType="decimal-pad"
              value={taxValue}
              onChangeText={handleTaxChange}
            />
            <View style={styles.taxServiceTypeContainer}>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  taxType === 'percentage' && styles.typeButtonSelected,
                ]}
                onPress={() => {
                  setTaxType('percentage');
                  setTaxError('');
                }}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    taxType === 'percentage' && styles.typeButtonTextSelected,
                  ]}
                >
                  %
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  taxType === 'fixed' && styles.typeButtonSelected,
                ]}
                onPress={() => {
                  setTaxType('fixed');
                  setTaxError('');
                }}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    taxType === 'fixed' && styles.typeButtonTextSelected,
                  ]}
                >
                  {form.currency}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity style={styles.updateButton} onPress={handleUpdateTax}>
            <Text style={styles.updateButtonText}>Update Tax</Text>
          </TouchableOpacity>
          {taxError && <Text style={styles.errorText}>{taxError}</Text>}
        </View>

        {/* Service Charge Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Service Charge</Text>
          <View style={styles.taxServiceContainer}>
            <TextInput
              style={styles.taxServiceInput}
              placeholder="0"
              placeholderTextColor="#ccc"
              keyboardType="decimal-pad"
              value={serviceChargeValue}
              onChangeText={handleServiceChargeChange}
            />
            <View style={styles.taxServiceTypeContainer}>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  serviceChargeType === 'percentage' && styles.typeButtonSelected,
                ]}
                onPress={() => {
                  setServiceChargeType('percentage');
                  setServiceChargeError('');
                }}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    serviceChargeType === 'percentage' && styles.typeButtonTextSelected,
                  ]}
                >
                  %
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  serviceChargeType === 'fixed' && styles.typeButtonSelected,
                ]}
                onPress={() => {
                  setServiceChargeType('fixed');
                  setServiceChargeError('');
                }}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    serviceChargeType === 'fixed' && styles.typeButtonTextSelected,
                  ]}
                >
                  {form.currency}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity style={styles.updateButton} onPress={handleUpdateServiceCharge}>
            <Text style={styles.updateButtonText}>Update Service Charge</Text>
          </TouchableOpacity>
          {serviceChargeError && (
            <Text style={styles.errorText}>{serviceChargeError}</Text>
          )}
        </View>

        {/* Total Display */}
        {form.items.length > 0 && (
          <View style={styles.totalBox}>
            {form.taxAmount > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Tax</Text>
                <Text style={styles.totalValue}>{formatCurrency(form.taxAmount)}</Text>
              </View>
            )}
            {form.serviceChargeAmount > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Service Charge</Text>
                <Text style={styles.totalValue}>{formatCurrency(form.serviceChargeAmount)}</Text>
              </View>
            )}
            <View style={[styles.totalRow, styles.grandTotalRow]}>
              <Text style={styles.grandTotalLabel}>Grand Total</Text>
              <Text style={styles.grandTotalValue}>{formatCurrency(form.grandTotal)}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.backButton} onPress={onPrevious}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.nextButton, form.items.length === 0 && styles.nextButtonDisabled]}
          onPress={handleNext}
          disabled={form.items.length === 0}
        >
          <Text style={styles.nextButtonText}>Next →</Text>
        </TouchableOpacity>
      </View>

      {/* Add Item Modal */}
      <Modal
        visible={showAddItemModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAddItemModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Item</Text>
              <TouchableOpacity onPress={() => setShowAddItemModal(false)}>
                <Text style={styles.modalCloseButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalLabel}>Item Name *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g., Burger"
                placeholderTextColor="#ccc"
                value={itemInput.name}
                onChangeText={text => setItemInput({ ...itemInput, name: text })}
              />

              <Text style={styles.modalLabel}>Price ({form.currency}) *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="0.00"
                placeholderTextColor="#ccc"
                keyboardType="decimal-pad"
                value={itemInput.price}
                onChangeText={text => setItemInput({ ...itemInput, price: text })}
              />

              <Text style={styles.modalLabel}>Quantity *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="1"
                placeholderTextColor="#ccc"
                keyboardType="number-pad"
                value={itemInput.quantity}
                onChangeText={text => setItemInput({ ...itemInput, quantity: text })}
              />

              {itemError && <Text style={styles.errorText}>{itemError}</Text>}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowAddItemModal(false)}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalAddButton}
                onPress={handleAddItem}
              >
                <Text style={styles.modalAddButtonText}>Add Item</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    marginTop: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  itemCount: {
    fontSize: 12,
    color: '#999',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginBottom: 12,
  },
  emptyStateIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  emptyStateSubtext: {
    fontSize: 12,
    color: '#999',
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginBottom: 8,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  itemDetails: {
    fontSize: 12,
    color: '#999',
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ffebee',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    fontSize: 16,
    color: '#d32f2f',
  },
  addButton: {
    borderWidth: 2,
    borderColor: '#4caf50',
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4caf50',
  },
  errorText: {
    fontSize: 12,
    color: '#d32f2f',
    marginTop: 8,
  },
  calculationBox: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 20,
  },
  calculationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  calculationLabel: {
    fontSize: 14,
    color: '#666',
  },
  calculationValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  taxServiceContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  taxServiceInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#000',
    backgroundColor: '#fafafa',
  },
  taxServiceTypeContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  typeButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fafafa',
  },
  typeButtonSelected: {
    backgroundColor: '#e8f5e9',
    borderColor: '#4caf50',
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
  },
  typeButtonTextSelected: {
    color: '#4caf50',
  },
  updateButton: {
    backgroundColor: '#2196f3',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  updateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  totalBox: {
    backgroundColor: '#e8f5e9',
    borderRadius: 8,
    padding: 12,
    marginVertical: 20,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#c8e6c9',
  },
  grandTotalRow: {
    borderBottomWidth: 0,
  },
  totalLabel: {
    fontSize: 13,
    color: '#2e7d32',
  },
  totalValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2e7d32',
  },
  grandTotalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1b5e20',
  },
  grandTotalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1b5e20',
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 12,
  },
  backButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  nextButton: {
    flex: 1,
    backgroundColor: '#4caf50',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  nextButtonDisabled: {
    backgroundColor: '#ccc',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 16,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  modalCloseButton: {
    fontSize: 24,
    color: '#999',
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#000',
    backgroundColor: '#fafafa',
    marginBottom: 16,
  },
  modalFooter: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  modalAddButton: {
    flex: 1,
    backgroundColor: '#4caf50',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalAddButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default Step3BillDetails;
