/**
 * Step 6: Review and Create Bill
 * File: frontend/app/(tabs)/create-bill-step6.tsx
 * 
 * Final review of all bill details:
 * - Display all items, tax, service charge
 * - Show breakdown for each participant
 * - Validate everything is correct
 * - Create the bill
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useSplitBill } from '../../contexts/SplitBillContext';
import { validateCreateBillForm } from '../../utils/splitBillValidation';

interface Step6Props {
  onNext: () => void;
  onPrevious: () => void;
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const Step6Review: React.FC<Step6Props> = ({ onNext, onPrevious }) => {
  const { form } = useSplitBill();
  const [isCreating, setIsCreating] = useState(false);
  const [validationError, setValidationError] = useState('');

  const handleCreateBill = async () => {
    // DEBUG: Log current state
    console.log('📋 [Step6] Creating bill with:');
    console.log('  - splitMethod:', form.splitMethod);
    console.log('  - participants:', form.participants);
    console.log('  - items:', form.items);
    console.log('  - breakdown:', form.breakdown);
    console.log('  - grandTotal:', form.grandTotal);

    // Validate everything
    const validation = validateCreateBillForm(form);
    if (!validation.valid) {
      setValidationError(validation.error || 'Validation failed');
      Alert.alert('Validation Error', validation.error || 'Please check your bill details');
      return;
    }

    setIsCreating(true);

    try {
      // Call API to create bill (integrate with your backend)
      const response = await fetch('/api/bills', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: form.title,
          currency: form.currency,
          items: form.items,
          taxation: {
            tax: {
              value: form.taxValue,
              type: form.taxType,
            },
            serviceCharge: {
              value: form.serviceChargeValue,
              type: form.serviceChargeType,
            },
          },
          participants: form.participants,
          splitMethod: form.splitMethod,
          breakdown: form.breakdown,
          grandTotal: form.grandTotal,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create bill');
      }

      Alert.alert('Success', 'Bill created successfully!', [
        {
          text: 'OK',
          onPress: () => {
            onNext();
          },
        },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to create bill. Please try again.');
      console.error('Error creating bill:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const getSplitMethodName = () => {
    switch (form.splitMethod) {
      case 'EQUAL':
        return 'Equal Split';
      case 'ITEM':
        return 'Split by Item';
      case 'PERCENTAGE':
        return 'Percentage Split';
      case 'CUSTOM':
        return 'Custom Split';
      default:
        return 'Unknown';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.stepNumber}>Step 6 of 6</Text>
        <Text style={styles.title}>Review Bill</Text>
        <Text style={styles.subtitle}>Check all details before creating</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Bill Title */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Bill Details</Text>
          </View>
          <View style={styles.detailCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Name</Text>
              <Text style={styles.detailValue}>{form.title}</Text>
            </View>
            <View style={[styles.detailRow, styles.detailRowBorder]}>
              <Text style={styles.detailLabel}>Currency</Text>
              <Text style={styles.detailValue}>{form.currency}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Split Method</Text>
              <Text style={styles.detailValue}>{getSplitMethodName()}</Text>
            </View>
          </View>
        </View>

        {/* Items */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Items</Text>
            <Text style={styles.itemCount}>{form.items.length}</Text>
          </View>
          <View style={styles.itemsList}>
            {form.items.map((item, index) => (
              <View
                key={item.id}
                style={[styles.itemRow, index < form.items.length - 1 && styles.itemRowBorder]}
              >
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemQuantity}>Qty: {item.quantity}</Text>
                </View>
                <View style={styles.itemPrice}>
                  <Text style={styles.itemPriceLabel}>
                    {formatCurrency(item.price)} × {item.quantity}
                  </Text>
                  <Text style={styles.itemTotal}>
                    {formatCurrency(item.price * item.quantity)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Calculations */}
        <View style={styles.section}>
          <View style={styles.calculationBox}>
            <View style={styles.calculationRow}>
              <Text style={styles.calculationLabel}>Subtotal</Text>
              <Text style={styles.calculationValue}>{formatCurrency(form.subtotal)}</Text>
            </View>
            {form.taxAmount > 0 && (
              <View style={styles.calculationRow}>
                <Text style={styles.calculationLabel}>
                  Tax ({form.taxType === 'percentage' ? `${form.taxValue}%` : form.currency})
                </Text>
                <Text style={styles.calculationValue}>{formatCurrency(form.taxAmount)}</Text>
              </View>
            )}
            {form.serviceChargeAmount > 0 && (
              <View style={styles.calculationRow}>
                <Text style={styles.calculationLabel}>
                  Service Charge (
                  {form.serviceChargeType === 'percentage'
                    ? `${form.serviceChargeValue}%`
                    : form.currency}
                  )
                </Text>
                <Text style={styles.calculationValue}>
                  {formatCurrency(form.serviceChargeAmount)}
                </Text>
              </View>
            )}
            <View style={[styles.calculationRow, styles.grandTotalRow]}>
              <Text style={styles.grandTotalLabel}>Grand Total</Text>
              <Text style={styles.grandTotalValue}>{formatCurrency(form.grandTotal)}</Text>
            </View>
          </View>
        </View>

        {/* Participants and Breakdown */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Breakdown</Text>
            <Text style={styles.participantCount}>{form.participants.length}</Text>
          </View>
          <View style={styles.breakdownList}>
            {form.breakdown.map((breakdown, index) => {
              const participant = form.participants.find(p => p.id === breakdown.participantId);
              return (
                <View
                  key={breakdown.participantId}
                  style={[
                    styles.breakdownRow,
                    index < form.breakdown.length - 1 && styles.breakdownRowBorder,
                  ]}
                >
                  <View style={styles.participantInfo}>
                    <Text style={styles.participantName}>{participant?.name}</Text>
                    {breakdown.items && breakdown.items.length > 0 && (
                      <Text style={styles.participantItems}>
                        {breakdown.items.length} item(s)
                      </Text>
                    )}
                  </View>
                  <Text style={styles.breakdownAmount}>
                    {formatCurrency(breakdown.amount)}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Verify Total */}
          <View style={styles.verifyBox}>
            <Text style={styles.verifyLabel}>Sum of breakdown:</Text>
            <Text style={styles.verifyValue}>
              {formatCurrency(form.breakdown.reduce((sum, b) => sum + b.amount, 0))}
            </Text>
            <Text style={styles.verifyLabel}>Grand total:</Text>
            <Text style={styles.verifyValue}>{formatCurrency(form.grandTotal)}</Text>
            {Math.abs(
              form.breakdown.reduce((sum, b) => sum + b.amount, 0) - form.grandTotal
            ) < 0.01 ? (
              <View style={styles.checkmark}>
                <Text style={styles.checkmarkText}>✓ Totals match</Text>
              </View>
            ) : (
              <View style={styles.mismatch}>
                <Text style={styles.mismatchText}>⚠ Totals do not match</Text>
              </View>
            )}
          </View>
        </View>

        {validationError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{validationError}</Text>
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.backButton} onPress={onPrevious}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.createButton, isCreating && styles.createButtonDisabled]}
          onPress={handleCreateBill}
          disabled={isCreating}
        >
          <Text style={styles.createButtonText}>
            {isCreating ? 'Creating...' : 'Create Bill'}
          </Text>
        </TouchableOpacity>
      </View>
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
  participantCount: {
    fontSize: 12,
    color: '#999',
  },
  detailCard: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  detailRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailLabel: {
    fontSize: 13,
    color: '#666',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000',
  },
  itemsList: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  itemRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  itemQuantity: {
    fontSize: 12,
    color: '#999',
  },
  itemPrice: {
    alignItems: 'flex-end',
  },
  itemPriceLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
  },
  itemTotal: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000',
  },
  calculationBox: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  calculationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  calculationLabel: {
    fontSize: 13,
    color: '#666',
  },
  calculationValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000',
  },
  grandTotalRow: {
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    paddingTopVertical: 8,
    marginTopVertical: 8,
  },
  grandTotalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
  },
  grandTotalValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4caf50',
  },
  breakdownList: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  breakdownRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  participantInfo: {
    flex: 1,
  },
  participantName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  participantItems: {
    fontSize: 12,
    color: '#999',
  },
  breakdownAmount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000',
  },
  verifyBox: {
    backgroundColor: '#e8f5e9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTopVertical: 12,
  },
  verifyLabel: {
    fontSize: 12,
    color: '#2e7d32',
    marginBottom: 2,
  },
  verifyValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2e7d32',
    marginBottom: 8,
  },
  checkmark: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkmarkText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2e7d32',
  },
  mismatch: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mismatchText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#f57c00',
  },
  errorBox: {
    backgroundColor: '#ffebee',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 12,
    color: '#d32f2f',
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
  createButton: {
    flex: 1,
    backgroundColor: '#4caf50',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  createButtonDisabled: {
    backgroundColor: '#ccc',
  },
});

export default Step6Review;
