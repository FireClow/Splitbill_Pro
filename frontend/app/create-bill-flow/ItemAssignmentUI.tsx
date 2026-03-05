/**
 * Item Assignment Component for Split by Item
 * File: frontend/app/create-bill-flow/ItemAssignmentUI.tsx
 * 
 * Memungkinkan user assign items ke participants
 * Digunakan dalam Step 5 setelah memilih ITEM split method
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { useSplitBill } from '../../contexts/SplitBillContext';
import { Ionicons } from '@expo/vector-icons';

interface ItemAssignmentUIProps {
  onNext: () => void;
  onPrevious: () => void;
}

const ItemAssignmentUI: React.FC<ItemAssignmentUIProps> = ({ onNext, onPrevious }) => {
  const { form, updateItemAssignment } = useSplitBill();
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [error, setError] = useState('');

  console.log('📋 [ItemAssignmentUI] Component rendered!');
  console.log('📋 [ItemAssignmentUI] Form items:', form.items);
  console.log('📋 [ItemAssignmentUI] Form participants:', form.participants);

  // Validate all items have at least 1 assignment
  const validateAssignments = (): boolean => {
    for (const item of form.items) {
      if (!item.assignedTo || item.assignedTo.length === 0) {
        setError(`"${item.name}" must be assigned to at least one person`);
        return false;
      }
    }
    setError('');
    return true;
  };

  const handleToggleAssignment = (itemId: string, participantId: string) => {
    const item = form.items.find(i => i.id === itemId);
    if (!item) return;

    const currentAssignments = item.assignedTo || [];
    let newAssignments: string[];

    if (currentAssignments.includes(participantId)) {
      // Remove if already assigned (but need at least 1)
      if (currentAssignments.length > 1) {
        newAssignments = currentAssignments.filter(id => id !== participantId);
      } else {
        setError(`"${item.name}" must be assigned to at least one person`);
        return;
      }
    } else {
      // Add to assignment
      newAssignments = [...currentAssignments, participantId];
    }

    updateItemAssignment(itemId, newAssignments);
    setError('');
  };

  const handleNext = () => {
    if (validateAssignments()) {
      onNext();
    }
  };

  const getAssignmentSummary = (itemId: string): string => {
    const item = form.items.find(i => i.id === itemId);
    if (!item || !item.assignedTo || item.assignedTo.length === 0) {
      return 'Not assigned';
    }

    const assignedNames = form.participants
      .filter(p => item.assignedTo?.includes(p.id))
      .map(p => p.name)
      .join(', ');

    return assignedNames;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Assign Items</Text>
        <Text style={styles.subtitle}>Who ordered what?</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {form.items.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyText}>No items to assign</Text>
          </View>
        ) : (
          <View style={styles.itemsList}>
            {form.items.map((item, index) => (
              <View key={item.id} style={styles.itemContainer}>
                {/* Item Header - Click to Expand */}
                <TouchableOpacity
                  style={[
                    styles.itemHeader,
                    expandedItemId === item.id && styles.itemHeaderExpanded,
                  ]}
                  onPress={() =>
                    setExpandedItemId(expandedItemId === item.id ? null : item.id)
                  }
                >
                  <View style={styles.itemInfo}>
                    <View style={styles.itemNumber}>
                      <Text style={styles.itemNumberText}>{index + 1}</Text>
                    </View>
                    <View style={styles.itemNamePrice}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <Text style={styles.itemPrice}>
                        Qty: {item.quantity} × Rp {item.price.toLocaleString('id-ID')}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.itemActions}>
                    <Text style={styles.assignmentCount}>
                      {item.assignedTo?.length || 0}/{form.participants.length}
                    </Text>
                    <Ionicons
                      name={expandedItemId === item.id ? 'chevron-up' : 'chevron-down'}
                      size={24}
                      color="#1976D2"
                    />
                  </View>
                </TouchableOpacity>

                {/* Assignment Summary */}
                {expandedItemId !== item.id && (
                  <View style={styles.itemSummary}>
                    <Text style={styles.summaryText}>
                      {getAssignmentSummary(item.id)}
                    </Text>
                  </View>
                )}

                {/* Expanded Assignment UI */}
                {expandedItemId === item.id && (
                  <View style={styles.assignmentView}>
                    <Text style={styles.assignmentLabel}>Assign to:</Text>
                    <View style={styles.checkboxList}>
                      {form.participants.map(participant => {
                        const isAssigned = item.assignedTo?.includes(participant.id);
                        return (
                          <TouchableOpacity
                            key={participant.id}
                            style={[
                              styles.checkboxItem,
                              isAssigned && styles.checkboxItemSelected,
                            ]}
                            onPress={() =>
                              handleToggleAssignment(item.id, participant.id)
                            }
                          >
                            <View
                              style={[
                                styles.checkbox,
                                isAssigned && styles.checkboxChecked,
                              ]}
                            >
                              {isAssigned && (
                                <Ionicons name="checkmark" size={16} color="white" />
                              )}
                            </View>
                            <Text
                              style={[
                                styles.checkboxLabel,
                                isAssigned && styles.checkboxLabelSelected,
                              ]}
                            >
                              {participant.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* Error if no assignment */}
                {(!item.assignedTo || item.assignedTo.length === 0) && (
                  <View style={styles.errorBox}>
                    <Ionicons name="alert-circle" size={16} color="#D32F2F" />
                    <Text style={styles.errorMessage}>
                      Must assign to at least one person
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Global Error */}
        {error && (
          <View style={styles.globalErrorBox}>
            <Ionicons name="alert-circle" size={16} color="#D32F2F" />
            <Text style={styles.globalErrorText}>{error}</Text>
          </View>
        )}

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={20} color="#1976D2" />
          <Text style={styles.infoText}>
            Each item must be assigned to at least one person. The cost will be split
            among assigned people.
          </Text>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.backButton} onPress={onPrevious}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.nextButton, error && styles.nextButtonDisabled]}
          onPress={handleNext}
          disabled={!!error}
        >
          <Text style={styles.nextButtonText}>Next →</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafafa',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  itemsList: {
    gap: 12,
  },
  itemContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f5f5f5',
  },
  itemHeaderExpanded: {
    backgroundColor: '#e3f2fd',
  },
  itemInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1976D2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemNumberText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  itemNamePrice: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  itemPrice: {
    fontSize: 13,
    color: '#666',
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  assignmentCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976D2',
    minWidth: 30,
    textAlign: 'right',
  },
  itemSummary: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fafafa',
  },
  summaryText: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
  },
  assignmentView: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#f9f9f9',
  },
  assignmentLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  checkboxList: {
    gap: 8,
  },
  checkboxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  checkboxItemSelected: {
    backgroundColor: '#e3f2fd',
    borderColor: '#1976D2',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  checkboxChecked: {
    backgroundColor: '#1976D2',
    borderColor: '#1976D2',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  checkboxLabelSelected: {
    fontWeight: '500',
    color: '#1976D2',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#ffebee',
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#D32F2F',
    marginTop: 8,
    gap: 8,
  },
  errorMessage: {
    fontSize: 13,
    color: '#D32F2F',
    flex: 1,
  },
  globalErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#ffebee',
    borderRadius: 6,
    marginVertical: 12,
    gap: 8,
  },
  globalErrorText: {
    fontSize: 13,
    color: '#D32F2F',
    flex: 1,
  },
  infoBox: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#e3f2fd',
    borderRadius: 6,
    marginVertical: 16,
    gap: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#1565C0',
    flex: 1,
  },
  emptyState: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#999',
    marginBottom: 4,
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    gap: 12,
  },
  backButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  nextButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#1976D2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextButtonDisabled: {
    opacity: 0.5,
  },
  nextButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});

export default ItemAssignmentUI;
