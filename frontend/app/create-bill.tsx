import { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput, Alert, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, ApiError } from '../utils/api';
import { Colors } from '../utils/colors';
import { useAuth } from '../contexts/AuthContext';
import { useInterstitialAd } from '../hooks/useInterstitialAd';
import { ItemAssignmentEditor } from '../components/ItemAssignmentEditor';
import {
  applyClampedAssignment,
  getAssignedTotal,
  getSafeItemQuantity,
  mapAssignmentsToApiList,
} from '../utils/itemAssignments';

interface ItemDraft {
  id: string;
  name: string;
  price: string;
  quantity: string;
  assignments: Record<string, number>;
}

interface ParticipantDraft {
  id: string;
  name: string;
  contact_info: string;
}

const dedupeParticipantsByUserId = (participants: ParticipantDraft[]): ParticipantDraft[] => {
  return participants.filter(
    (participant, index, self) => index === self.findIndex((candidate) => candidate.id === participant.id)
  );
};

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'INR', 'SGD', 'KRW', 'MXN', 'BRL', 'THB', 'IDR', 'MYR'];

const createId = (prefix: string): string => {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
};

export default function CreateBillScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const { trackBillCreation } = useInterstitialAd(user?.isPremium);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [createBlockedReason, setCreateBlockedReason] = useState('');

  const [title, setTitle] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);

  const [items, setItems] = useState<ItemDraft[]>([
    { id: createId('item'), name: '', price: '', quantity: '1', assignments: {} },
  ]);
  const [participants, setParticipants] = useState<ParticipantDraft[]>([]);
  const [newParticipantName, setNewParticipantName] = useState('');
  const [assignmentWarnings, setAssignmentWarnings] = useState<Record<string, string>>({});

  const [taxType, setTaxType] = useState<'percentage' | 'fixed'>('percentage');
  const [taxValue, setTaxValue] = useState('');
  const [serviceCharge, setServiceCharge] = useState('');

  // Load receipt data from scan if provided
  useEffect(() => {
    if (params.receiptData) {
      try {
        const receiptData = JSON.parse(params.receiptData as string);
        
        // Populate items
        if (receiptData.items && receiptData.items.length > 0) {
          setItems(receiptData.items.map((item: any) => ({
            id: createId('item'),
            name: item.name,
            price: item.price.toString(),
            quantity: item.quantity.toString(),
            assignments: {},
          })));
        }
        
        // Set currency
        if (receiptData.currency) {
          setCurrency(receiptData.currency);
        }
        
        // Set tax
        if (receiptData.tax) {
          setTaxValue(receiptData.tax.toString());
        }
        
        // Set service charge
        if (receiptData.service_charge) {
          setServiceCharge(receiptData.service_charge.toString());
        }
        
      } catch (error) {
        console.warn('Failed to parse receipt data:', error);
      }
    }
  }, [params.receiptData]);

  const addItem = () => setItems([
    ...items,
    { id: createId('item'), name: '', price: '', quantity: '1', assignments: {} },
  ]);
  const removeItem = (i: number) => {
    const itemId = items[i]?.id;
    setItems(items.filter((_, idx) => idx !== i));
    if (itemId) {
      setAssignmentWarnings((prev) => {
        const updated = { ...prev };
        delete updated[itemId];
        return updated;
      });
    }
  };
  const updateItem = (i: number, field: keyof ItemDraft, value: string) => {
    const updated = [...items];
    updated[i] = { ...updated[i], [field]: value };
    setItems(updated);
  };

  const addParticipant = () => {
    if (!newParticipantName.trim()) return;
    setParticipants((prev) => ([
      ...prev,
      { id: createId('participant'), name: newParticipantName.trim(), contact_info: '' },
    ]));
    setNewParticipantName('');
  };
  const removeParticipant = (i: number) => {
    const participantId = participants[i]?.id;
    setParticipants((prev) => prev.filter((_, idx) => idx !== i));

    if (participantId) {
      setItems(prevItems =>
        prevItems.map(item => ({
          ...item,
          assignments: Object.fromEntries(
            Object.entries(item.assignments).filter(([pid]) => pid !== participantId)
          ),
        }))
      );
    }
  };

  const getItemQuantity = useCallback((item: ItemDraft) => getSafeItemQuantity(item.quantity), []);

  const updateDraftAssignment = useCallback((itemId: string, participantId: string, requestedQty: number) => {
    setItems(prevItems => prevItems.map(item => {
      if (item.id !== itemId) return item;

      const quantity = getItemQuantity(item);
      const currentAssignments = item.assignments || {};
      const { nextAssignments, maxAllowed, wasClamped } = applyClampedAssignment(
        currentAssignments,
        participantId,
        requestedQty,
        quantity
      );

      setAssignmentWarnings((prev) => {
        const updated = { ...prev };
        if (wasClamped) {
          updated[itemId] = `Cannot assign more than remaining quantity. Max for this user: ${maxAllowed}.`;
        } else {
          delete updated[itemId];
        }
        return updated;
      });

      return {
        ...item,
        assignments: nextAssignments,
      };
    }));
  }, [getItemQuantity]);

  const adjustDraftAssignment = useCallback((itemId: string, participantId: string, delta: number) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    const current = item.assignments?.[participantId] || 0;
    updateDraftAssignment(itemId, participantId, current + delta);
  }, [items, updateDraftAssignment]);

  const handleDraftAssignmentInput = useCallback((itemId: string, participantId: string, text: string) => {
    const parsed = Number.parseInt(text.replace(/[^0-9]/g, ''), 10);
    if (Number.isNaN(parsed)) {
      updateDraftAssignment(itemId, participantId, 0);
      return;
    }
    updateDraftAssignment(itemId, participantId, parsed);
  }, [updateDraftAssignment]);

  // Validate current step
  const validateStep = (currentStep: number): string | null => {
    if (currentStep === 0) { // Details
      if (!title.trim()) return 'Please enter a bill title';
      return null;
    }
    if (currentStep === 1) { // Items
      const validItems = items.filter(i => i.name.trim() && parseFloat(i.price) > 0);
      if (validItems.length === 0) return 'Please add at least one item with name and price';
      return null;
    }
    if (currentStep === 2) { // People
      if (participants.length === 0) return 'Please add at least one person';
      return null;
    }
    if (currentStep === 3) { // Assign
      const validItems = items.filter(i => i.name.trim() && parseFloat(i.price) > 0);
      for (const item of validItems) {
        const expected = getItemQuantity(item);
        const assigned = getAssignedTotal(item.assignments || {});
        if (assigned !== expected) {
          return `Item "${item.name}" assignment must equal quantity (${expected}). Current: ${assigned}.`;
        }
      }
      return null;
    }
    return null;
  };

  const canProceed = validateStep(step) === null;
  const stepError = validateStep(step);

  // Format currency with thousand separator
  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const subtotal = items.reduce((sum, item) => {
    const p = parseFloat(item.price) || 0;
    const q = parseInt(item.quantity) || 1;
    return sum + p * q;
  }, 0);

  const taxAmount = taxType === 'percentage'
    ? subtotal * (parseFloat(taxValue) || 0) / 100
    : parseFloat(taxValue) || 0;

  const total = subtotal + taxAmount + (parseFloat(serviceCharge) || 0);

  useEffect(() => {
    if (createBlockedReason) {
      setCreateBlockedReason('');
    }
    // Clear blocked state whenever user changes bill data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, currency, items, participants, taxType, taxValue, serviceCharge]);

  const calculateByItemShares = useCallback(() => {
    const shares: Record<string, number> = {};
    participants.forEach(participant => {
      shares[participant.id] = 0;
    });

    const validItems = items.filter(i => i.name.trim() && parseFloat(i.price) > 0);
    validItems.forEach(item => {
      const unitPrice = parseFloat(item.price) || 0;
      Object.entries(item.assignments || {}).forEach(([participantId, assignedQty]) => {
        if (shares[participantId] !== undefined) {
          shares[participantId] += unitPrice * assignedQty;
        }
      });
    });

    return shares;
  }, [items, participants]);

  const handleSave = async () => {
    if (createBlockedReason) {
      Alert.alert('Create Blocked', createBlockedReason);
      return;
    }

    if (!title.trim()) { Alert.alert('Error', 'Please enter a bill title'); return; }
    const validItems = items.filter(i => i.name.trim() && parseFloat(i.price) > 0);
    if (validItems.length === 0) { Alert.alert('Error', 'Please add at least one item'); return; }
    const uniqueParticipants = dedupeParticipantsByUserId(participants);
    if (uniqueParticipants.length === 0) { Alert.alert('Error', 'Please add at least one person'); return; }

    if (uniqueParticipants.length !== participants.length) {
      setParticipants(uniqueParticipants);
    }

    for (const item of validItems) {
      const assigned = getAssignedTotal(item.assignments || {});
      const expected = getItemQuantity(item);
      if (assigned !== expected) {
        Alert.alert('Warning', `Assignment for "${item.name}" must equal quantity (${expected}). Current: ${assigned}.`);
        return;
      }
    }

    setSaving(true);
    try {
      const billData = {
        title: title.trim(),
        currency,
        items: validItems.map(i => ({
          name: i.name.trim(),
          price: parseFloat(i.price),
          quantity: parseInt(i.quantity) || 1,
          assigned_to: Object.keys(i.assignments || {}),
          assigned_quantities: i.assignments || {},
          assignments: mapAssignmentsToApiList(i.assignments || {}),
        })),
        participants: uniqueParticipants.map(p => ({
          name: p.name,
          contact_info: p.contact_info,
          client_id: p.id,
        })),
        tax_type: taxType,
        tax_value: parseFloat(taxValue) || 0,
        service_charge: parseFloat(serviceCharge) || 0,
        // Product decision: keep create-bill simple, always split by item.
        split_method: 'per_item',
      };
      const result = await api.createBill(billData);
      // Track this bill creation for ad frequency
      await trackBillCreation();
      router.replace(`/bill/${result.bill_id}`);
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 403 && err.message.includes('Active bill limit reached')) {
        const msg = 'Active bill limit reached for this account. Settle/archive old bills or upgrade plan.';
        setCreateBlockedReason(msg);
        Alert.alert('Limit Reached', msg);
        return;
      }
      Alert.alert('Error', err.message || 'Failed to create bill');
    } finally {
      setSaving(false);
    }
  };

  const steps = ['Details', 'Items', 'People', 'Assign', 'Review'];
  const validItems = useMemo(
    () => items.filter(i => i.name.trim() && parseFloat(i.price) > 0),
    [items]
  );
  const byItemShares = useMemo(() => calculateByItemShares(), [calculateByItemShares]);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.topBar}>
          <TouchableOpacity testID="close-create-bill" onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={28} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>New Bill</Text>
          <View style={{ width: 28 }} />
        </View>

        <View style={styles.stepsRow}>
          {steps.map((s, i) => (
            <View key={i} style={styles.stepItem}>
              <View style={[styles.stepDot, i <= step && styles.stepDotActive]} />
              <Text style={[styles.stepLabel, i <= step && styles.stepLabelActive]}>{s}</Text>
            </View>
          ))}
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {step === 0 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Bill Details</Text>
              <Text style={styles.inputLabel}>BILL TITLE</Text>
              <TextInput testID="bill-title-input" style={styles.input} placeholder="e.g. Dinner at Restaurant" placeholderTextColor={Colors.muted} value={title} onChangeText={setTitle} />
              <Text style={styles.inputLabel}>CURRENCY</Text>
              <TouchableOpacity testID="currency-picker-btn" style={styles.input} onPress={() => setShowCurrencyPicker(!showCurrencyPicker)}>
                <Text style={styles.inputText}>{currency}</Text>
                <Ionicons name="chevron-down" size={18} color={Colors.muted} />
              </TouchableOpacity>
              {showCurrencyPicker && (
                <View style={styles.currencyGrid}>
                  {CURRENCIES.map(c => (
                    <TouchableOpacity key={c} testID={`currency-${c}`} style={[styles.currencyChip, currency === c && styles.currencyChipActive]} onPress={() => { setCurrency(c); setShowCurrencyPicker(false); }}>
                      <Text style={[styles.currencyChipText, currency === c && styles.currencyChipTextActive]}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

          {step === 1 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Add Items</Text>
              {items.map((item, i) => (
                <View key={i} style={styles.itemCard}>
                  <View style={styles.itemHeader}>
                    <Text style={styles.itemIndex}>Item {i + 1}</Text>
                    {items.length > 1 && (
                      <TouchableOpacity testID={`remove-item-${i}`} onPress={() => removeItem(i)}>
                        <Ionicons name="trash-outline" size={18} color={Colors.error} />
                      </TouchableOpacity>
                    )}
                  </View>
                  <TextInput testID={`item-name-${i}`} style={styles.itemInput} placeholder="Item name" placeholderTextColor={Colors.muted} value={item.name} onChangeText={(v) => updateItem(i, 'name', v)} />
                  <View style={styles.itemRow}>
                    <View style={styles.itemField}>
                      <Text style={styles.miniLabel}>PRICE</Text>
                      <TextInput testID={`item-price-${i}`} style={styles.itemInput} placeholder="0.00" placeholderTextColor={Colors.muted} value={item.price} onChangeText={(v) => updateItem(i, 'price', v)} keyboardType="decimal-pad" />
                    </View>
                    <View style={styles.itemFieldSmall}>
                      <Text style={styles.miniLabel}>QTY</Text>
                      <TextInput testID={`item-qty-${i}`} style={styles.itemInput} placeholder="1" placeholderTextColor={Colors.muted} value={item.quantity} onChangeText={(v) => updateItem(i, 'quantity', v)} keyboardType="number-pad" />
                    </View>
                  </View>
                </View>
              ))}
              <TouchableOpacity testID="add-item-btn" style={styles.addItemBtn} onPress={addItem}>
                <Ionicons name="add-circle-outline" size={22} color={Colors.primary} />
                <Text style={styles.addItemText}>Add Item</Text>
              </TouchableOpacity>

              <View style={styles.divider} />
              <Text style={styles.subsectionTitle}>Tax & Fees</Text>
              <View style={styles.taxTypeRow}>
                <TouchableOpacity testID="tax-percentage-btn" style={[styles.taxTypeChip, taxType === 'percentage' && styles.taxTypeActive]} onPress={() => setTaxType('percentage')}>
                  <Text style={[styles.taxTypeText, taxType === 'percentage' && styles.taxTypeTextActive]}>Percentage %</Text>
                </TouchableOpacity>
                <TouchableOpacity testID="tax-fixed-btn" style={[styles.taxTypeChip, taxType === 'fixed' && styles.taxTypeActive]} onPress={() => setTaxType('fixed')}>
                  <Text style={[styles.taxTypeText, taxType === 'fixed' && styles.taxTypeTextActive]}>Fixed Amount</Text>
                </TouchableOpacity>
              </View>
              <TextInput testID="tax-value-input" style={styles.input} placeholder={taxType === 'percentage' ? 'Tax %' : 'Tax amount'} placeholderTextColor={Colors.muted} value={taxValue} onChangeText={setTaxValue} keyboardType="decimal-pad" />
              <Text style={styles.miniLabel}>SERVICE CHARGE</Text>
              <TextInput testID="service-charge-input" style={styles.input} placeholder="0.00" placeholderTextColor={Colors.muted} value={serviceCharge} onChangeText={setServiceCharge} keyboardType="decimal-pad" />
            </View>
          )}

          {step === 2 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Add People</Text>
              <View style={styles.subtitleRow}>
                <Text style={styles.stepSubtitle}>Add people sharing this bill</Text>
              </View>
              <View style={styles.addParticipantRow}>
                <TextInput testID="participant-name-input" style={[styles.input, { flex: 1, marginBottom: 0 }]} placeholder="Person name" placeholderTextColor={Colors.muted} value={newParticipantName} onChangeText={setNewParticipantName} onSubmitEditing={addParticipant} />
                <TouchableOpacity testID="add-participant-btn" style={styles.addParticipantBtn} onPress={addParticipant}>
                  <Ionicons name="add" size={24} color={Colors.primaryForeground} />
                </TouchableOpacity>
              </View>
              {participants.map((p, i) => (
                <View key={i} style={styles.participantCard}>
                  <View style={styles.participantAvatar}>
                    <Text style={styles.participantAvatarText}>{p.name[0].toUpperCase()}</Text>
                  </View>
                  <Text style={styles.participantName}>{p.name}</Text>
                  <TouchableOpacity testID={`remove-participant-${i}`} onPress={() => removeParticipant(i)}>
                    <Ionicons name="close-circle" size={22} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {step === 3 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Assign Items</Text>
              <Text style={styles.stepSubtitle}>Set exact quantity consumed by each participant.</Text>
              {validItems.length === 0 ? (
                <View style={styles.infoCard}>
                  <Text style={styles.infoText}>Add items first before assigning.</Text>
                </View>
              ) : participants.length === 0 ? (
                <View style={styles.infoCard}>
                  <Text style={styles.infoText}>Add participants first before assigning items.</Text>
                </View>
              ) : (
                validItems.map((item) => {
                  const itemQuantity = getItemQuantity(item);
                  const assignedTotal = getAssignedTotal(item.assignments || {});
                  const remaining = Math.max(0, itemQuantity - assignedTotal);

                  return (
                    <View key={item.id} style={styles.assignEditorCard}>
                      <View style={styles.assignEditorHeader}>
                        <Text style={styles.assignEditorItemName}>{item.name}</Text>
                        <Text style={styles.assignEditorItemMeta}>
                          x{itemQuantity} @ {currency} {formatCurrency(parseFloat(item.price) || 0)}
                        </Text>
                      </View>
                      <ItemAssignmentEditor
                        title=""
                        participants={participants.map(p => ({ participant_id: p.id, name: p.name }))}
                        assignments={item.assignments || {}}
                        unitPrice={parseFloat(item.price) || 0}
                        currency={currency}
                        itemQuantity={itemQuantity}
                        assignedTotal={assignedTotal}
                        remainingQuantity={remaining}
                        warning={assignmentWarnings[item.id] || ''}
                        onAdjust={(participantId, delta) => adjustDraftAssignment(item.id, participantId, delta)}
                        onInputChange={(participantId, text) => handleDraftAssignmentInput(item.id, participantId, text)}
                        showActions={false}
                      />
                    </View>
                  );
                })
              )}
            </View>
          )}

          {step === 4 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Review Bill</Text>
              <View style={styles.reviewCard}>
                <Text style={styles.reviewLabel}>BILL TITLE</Text>
                <Text style={styles.reviewValue}>{title || 'Untitled'}</Text>
                <View style={styles.reviewDivider} />
                <Text style={styles.reviewLabel}>ITEMS ({validItems.length})</Text>
                {validItems.map((item, i) => (
                  <View key={i} style={styles.reviewItem}>
                    <Text style={styles.reviewItemName}>{item.name} x{item.quantity || 1}</Text>
                    <Text style={styles.reviewItemPrice}>{currency} {formatCurrency(parseFloat(item.price) * (parseInt(item.quantity) || 1))}</Text>
                  </View>
                ))}

                <View style={styles.reviewDivider} />
                <Text style={styles.reviewLabel}>ASSIGNMENT</Text>
                {validItems.map((item, i) => {
                  const assignedRows = Object.entries(item.assignments || {})
                    .filter(([, qty]) => qty > 0)
                    .map(([participantId, qty]) => {
                      const participant = participants.find(p => p.id === participantId);
                      return participant ? `${participant.name} x${qty}` : `${participantId} x${qty}`;
                    });

                  return (
                    <View key={`assign_${i}`} style={styles.assignmentReviewBlock}>
                      <Text style={styles.assignmentReviewItem}>
                        {item.name} x{item.quantity || 1}
                      </Text>
                      <Text style={styles.assignmentReviewParticipants}>
                        Assigned to: {assignedRows.length ? assignedRows.join(', ') : 'Unassigned'}
                      </Text>
                    </View>
                  );
                })}
                <View style={styles.reviewDivider} />
                <View style={styles.reviewItem}>
                  <Text style={styles.reviewLabel}>SUBTOTAL</Text>
                  <Text style={styles.reviewValue}>{currency} {formatCurrency(subtotal)}</Text>
                </View>
                {taxAmount > 0 && (
                  <View style={styles.reviewItem}>
                    <Text style={styles.reviewSmallLabel}>Tax</Text>
                    <Text style={styles.reviewSmallValue}>{currency} {formatCurrency(taxAmount)}</Text>
                  </View>
                )}
                {parseFloat(serviceCharge) > 0 && (
                  <View style={styles.reviewItem}>
                    <Text style={styles.reviewSmallLabel}>Service Charge</Text>
                    <Text style={styles.reviewSmallValue}>{currency} {formatCurrency(parseFloat(serviceCharge))}</Text>
                  </View>
                )}
                <View style={styles.reviewDivider} />
                <View style={styles.reviewItem}>
                  <Text style={styles.totalLabel}>TOTAL</Text>
                  <Text style={styles.totalValue}>{currency} {formatCurrency(total)}</Text>
                </View>
              </View>
              <View style={styles.reviewCard}>
                <Text style={styles.reviewLabel}>PARTICIPANTS ({participants.length})</Text>
                <Text style={styles.reviewSmallValue}>{participants.map(p => p.name).join(', ')}</Text>
                <View style={styles.reviewDivider} />
                <Text style={styles.reviewLabel}>SPLIT METHOD</Text>
                <Text style={styles.reviewSmallValue}>By Item</Text>
                <View style={styles.reviewDivider} />
                <Text style={styles.reviewLabel}>BY ITEM SHARES</Text>
                {participants.map(p => (
                  <View key={`share_${p.id}`} style={styles.reviewItem}>
                    <Text style={styles.reviewSmallLabel}>{p.name}</Text>
                    <Text style={styles.reviewSmallValue}>
                      {currency} {formatCurrency(byItemShares[p.id] || 0)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.bottomBar}>
          {stepError && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color={Colors.error} />
              <Text style={styles.errorText}>{stepError}</Text>
            </View>
          )}
          {step > 0 && (
            <TouchableOpacity testID="prev-step-btn" style={styles.prevBtn} onPress={() => setStep(step - 1)}>
              <Ionicons name="arrow-back" size={20} color={Colors.white} />
              <Text style={styles.prevBtnText}>Back</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            testID={step < 4 ? 'next-step-btn' : 'save-bill-btn'}
            style={[
              styles.nextBtn,
              step === 0 && { flex: 1 },
              (!canProceed && step < 4) && styles.nextBtnDisabled,
              (step === 4 && !!createBlockedReason) && styles.nextBtnDisabled,
            ]}
            onPress={step < 4 ? () => { if (canProceed) setStep(step + 1); } : handleSave}
            disabled={saving || (!canProceed && step < 4) || (step === 4 && !!createBlockedReason)}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator size="small" color={Colors.primaryForeground} />
            ) : (
              <>
                <Text style={[styles.nextBtnText, (!canProceed && step < 4) && styles.nextBtnTextDisabled]}>{step < 4 ? 'Continue' : 'Create Bill'}</Text>
                {step < 4 && <Ionicons name="arrow-forward" size={20} color={(!canProceed && step < 4) ? Colors.muted : Colors.primaryForeground} />}
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 12 },
  topBarTitle: { fontSize: 18, fontWeight: '600', color: Colors.white },
  stepsRow: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 24, marginBottom: 24 },
  stepItem: { alignItems: 'center', gap: 6 },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border },
  stepDotActive: { backgroundColor: Colors.primary, width: 24 },
  stepLabel: { fontSize: 12, color: Colors.muted, fontWeight: '500' },
  stepLabelActive: { color: Colors.primary },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 32 },
  stepContent: { gap: 4 },
  stepTitle: { fontSize: 24, fontWeight: '700', color: Colors.white, letterSpacing: -0.5, marginBottom: 16 },
  stepSubtitle: { fontSize: 14, color: Colors.textMuted, marginBottom: 16, marginTop: -8 },
  inputLabel: { fontSize: 12, fontWeight: '500', color: Colors.textMuted, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8, marginTop: 12 },
  input: { backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, height: 56, paddingHorizontal: 16, color: Colors.white, fontSize: 16, marginBottom: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  inputText: { color: Colors.white, fontSize: 16 },
  currencyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, marginBottom: 8 },
  currencyChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  currencyChipActive: { backgroundColor: Colors.primary + '20', borderColor: Colors.primary },
  currencyChipText: { fontSize: 14, fontWeight: '500', color: Colors.muted },
  currencyChipTextActive: { color: Colors.primary },
  itemCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  itemIndex: { fontSize: 13, fontWeight: '600', color: Colors.primary, textTransform: 'uppercase', letterSpacing: 0.5 },
  itemInput: { backgroundColor: Colors.background, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, height: 48, paddingHorizontal: 14, color: Colors.white, fontSize: 15, marginBottom: 8 },
  itemRow: { flexDirection: 'row', gap: 12 },
  itemField: { flex: 2 },
  itemFieldSmall: { flex: 1 },
  miniLabel: { fontSize: 11, fontWeight: '500', color: Colors.textMuted, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6, marginTop: 8 },
  addItemBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: Colors.primary + '40', borderStyle: 'dashed', marginBottom: 16 },
  addItemText: { fontSize: 15, fontWeight: '600', color: Colors.primary },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 24 },
  subsectionTitle: { fontSize: 18, fontWeight: '600', color: Colors.white, marginBottom: 16, letterSpacing: -0.25 },
  taxTypeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  taxTypeChip: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  taxTypeActive: { backgroundColor: Colors.primary + '20', borderColor: Colors.primary },
  taxTypeText: { fontSize: 14, fontWeight: '500', color: Colors.muted },
  taxTypeTextActive: { color: Colors.primary },
  addParticipantRow: { flexDirection: 'row', gap: 12, marginBottom: 16, alignItems: 'center' },
  addParticipantBtn: { width: 56, height: 56, borderRadius: 16, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  participantCard: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  participantAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceHighlight, justifyContent: 'center', alignItems: 'center' },
  participantAvatarText: { fontSize: 16, fontWeight: '600', color: Colors.white },
  participantName: { flex: 1, fontSize: 16, fontWeight: '500', color: Colors.white },
  infoCard: { backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 16 },
  infoText: { color: Colors.textSecondary, fontSize: 14 },
  assignEditorCard: { backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 12, overflow: 'hidden' },
  assignEditorHeader: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  assignEditorItemName: { fontSize: 16, fontWeight: '700', color: Colors.white },
  assignEditorItemMeta: { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },
  splitMethodItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  splitMethodActive: { borderBottomColor: Colors.primary + '30' },
  splitMethodText: { fontSize: 16, fontWeight: '500', color: Colors.muted },
  splitMethodTextActive: { color: Colors.white },
  reviewCard: { backgroundColor: Colors.surface, borderRadius: 20, padding: 24, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  reviewLabel: { fontSize: 12, fontWeight: '500', color: Colors.textMuted, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 },
  reviewValue: { fontSize: 18, fontWeight: '600', color: Colors.white },
  reviewDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 16 },
  reviewItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  reviewItemName: { fontSize: 15, color: Colors.textSecondary },
  reviewItemPrice: { fontSize: 15, fontWeight: '600', color: Colors.white },
  reviewSmallLabel: { fontSize: 14, color: Colors.textMuted },
  reviewSmallValue: { fontSize: 14, fontWeight: '500', color: Colors.textSecondary },
  totalLabel: { fontSize: 16, fontWeight: '700', color: Colors.primary, letterSpacing: 0.5 },
  totalValue: { fontSize: 24, fontWeight: '800', color: Colors.primary, letterSpacing: -0.5 },
  bottomBar: { flexDirection: 'row', paddingHorizontal: 24, paddingVertical: 16, gap: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  prevBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, height: 56, borderRadius: 100, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  prevBtnText: { fontSize: 16, fontWeight: '600', color: Colors.white },
  nextBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 56, borderRadius: 100, backgroundColor: Colors.primary },
  nextBtnText: { fontSize: 16, fontWeight: '600', color: Colors.primaryForeground, letterSpacing: 0.5 },
  nextBtnDisabled: { opacity: 0.5 },
  nextBtnTextDisabled: { opacity: 0.6 },
  errorBox: { flexDirection: 'row', gap: 8, padding: 12, backgroundColor: Colors.error + '15', borderRadius: 8, marginBottom: 12, alignItems: 'center' },
  errorText: { fontSize: 14, color: Colors.error, flex: 1 },
  subtitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12 },
  statusBadge: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: Colors.success + '15', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  statusText: { fontSize: 12, color: Colors.success, fontWeight: '600' },
  assignmentReviewBlock: {
    marginBottom: 10,
  },
  assignmentReviewItem: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
  assignmentReviewParticipants: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
