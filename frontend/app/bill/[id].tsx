import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator, Share, Platform, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../utils/api';
import { Colors } from '../../utils/colors';

export default function BillDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [bill, setBill] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newPersonName, setNewPersonName] = useState('');
  const [shareLoading, setShareLoading] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemAssignedTo, setEditingItemAssignedTo] = useState<string[]>([]);

  const loadBill = useCallback(async () => {
    if (!id) return;
    try {
      const data = await api.getBill(id);
      setBill(data);
    } catch (err) {
      Alert.alert('Error', 'Failed to load bill');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadBill(); }, [loadBill]);

  const handleAddItem = async () => {
    if (!newItemName.trim() || !parseFloat(newItemPrice)) return;
    try {
      const updated = await api.addItem(id!, { name: newItemName.trim(), price: parseFloat(newItemPrice), quantity: 1 });
      setBill(updated);
      setNewItemName(''); setNewItemPrice(''); setShowAddItem(false);
    } catch (err: any) { Alert.alert('Error', err.message); }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      const updated = await api.deleteItem(id!, itemId);
      setBill(updated);
    } catch (err: any) { Alert.alert('Error', err.message); }
  };

  const handleAddPerson = async () => {
    if (!newPersonName.trim()) return;
    try {
      const updated = await api.addParticipant(id!, { name: newPersonName.trim() });
      setBill(updated);
      setNewPersonName(''); setShowAddPerson(false);
    } catch (err: any) { Alert.alert('Error', err.message); }
  };

  const handleRemovePerson = async (participantId: string) => {
    try {
      const updated = await api.removeParticipant(id!, participantId);
      setBill(updated);
    } catch (err: any) { Alert.alert('Error', err.message); }
  };

  const handleTogglePayment = async (split: any) => {
    const newStatus = split.status === 'paid' ? 'unpaid' : 'paid';
    const newAmount = newStatus === 'paid' ? split.amount_due : 0;
    try {
      const updated = await api.updatePayment(id!, split.participant_id, { amount_paid: newAmount, status: newStatus });
      setBill(updated);
    } catch (err: any) { Alert.alert('Error', err.message); }
  };

  const handleShare = async () => {
    setShareLoading(true);
    try {
      const link = await api.createShareLink(id!);
      const shareUrl = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/share/${link.token}`;
      if (Platform.OS === 'web') {
        const clipboard = (typeof navigator !== 'undefined' && (navigator as any).clipboard);
        if (clipboard?.writeText) {
          await clipboard.writeText(shareUrl);
          Alert.alert('Link Copied', 'Share link copied to clipboard');
        }
      } else {
        await Share.share({ message: `Check out this bill: ${shareUrl}`, url: shareUrl });
      }
    } catch (err: any) { Alert.alert('Error', err.message); }
    finally { setShareLoading(false); }
  };

  const handleDeleteBill = () => {
    Alert.alert('Delete Bill', 'This action cannot be undone', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await api.deleteBill(id!); router.replace('/(tabs)/home'); }
        catch (err: any) { Alert.alert('Error', err.message); }
      }},
    ]);
  };

  const handleChangeSplitMethod = async (method: string) => {
    try {
      const updated = await api.recalculateSplit(id!, { method });
      setBill(updated);
    } catch (err: any) { Alert.alert('Error', err.message); }
  };

  const handleEditItemAssignedTo = (itemId: string, currentAssignedTo: string[]) => {
    setEditingItemId(itemId);
    setEditingItemAssignedTo([...currentAssignedTo]);
  };

  const handleToggleParticipantForItem = (participantId: string) => {
    setEditingItemAssignedTo(prev =>
      prev.includes(participantId)
        ? prev.filter(id => id !== participantId)
        : [...prev, participantId]
    );
  };

  const handleSaveItemAssignedTo = async () => {
    if (!editingItemId) return;
    try {
      const updated = await api.updateItem(id!, editingItemId, { assigned_to: editingItemAssignedTo });
      setBill(updated);
      setEditingItemId(null);
      setEditingItemAssignedTo([]);
    } catch (err: any) { 
      Alert.alert('Error', err.message); 
    }
  };

  if (loading || !bill) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator testID="bill-detail-loading" size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const paidCount = bill.splits?.filter((s: any) => s.status === 'paid').length || 0;
  const totalParticipants = bill.splits?.length || 0;
  const paymentProgress = totalParticipants > 0 ? paidCount / totalParticipants : 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity testID="bill-back-btn" onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <View style={styles.topBarActions}>
          <TouchableOpacity testID="share-bill-btn" onPress={handleShare} style={styles.topBarBtn} disabled={shareLoading}>
            {shareLoading ? <ActivityIndicator size="small" color={Colors.primary} /> : <Ionicons name="share-outline" size={22} color={Colors.primary} />}
          </TouchableOpacity>
          <TouchableOpacity testID="delete-bill-btn" onPress={handleDeleteBill} style={styles.topBarBtn}>
            <Ionicons name="trash-outline" size={22} color={Colors.error} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.billHeader}>
          <Text style={styles.billTitle}>{bill.title}</Text>
          <View style={[styles.statusBadge, { backgroundColor: (bill.status === 'settled' ? Colors.success : Colors.primary) + '20' }]}>
            <Text style={[styles.statusText, { color: bill.status === 'settled' ? Colors.success : Colors.primary }]}>{bill.status?.toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>TOTAL AMOUNT</Text>
          <Text style={styles.totalAmount}>{bill.currency} {(bill.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
          <View style={styles.totalBreakdown}>
            <View style={styles.breakdownItem}>
              <Text style={styles.breakdownLabel}>Subtotal</Text>
              <Text style={styles.breakdownValue}>{(bill.subtotal || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
            </View>
            {bill.tax_amount > 0 && (
              <View style={styles.breakdownItem}>
                <Text style={styles.breakdownLabel}>Tax</Text>
                <Text style={styles.breakdownValue}>{(bill.tax_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
              </View>
            )}
            {bill.service_charge > 0 && (
              <View style={styles.breakdownItem}>
                <Text style={styles.breakdownLabel}>Service</Text>
                <Text style={styles.breakdownValue}>{(bill.service_charge || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
              </View>
            )}
          </View>
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${paymentProgress * 100}%` }]} />
            </View>
            <Text style={styles.progressText}>{paidCount}/{totalParticipants} paid</Text>
          </View>
        </View>

        {/* Items Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Items ({bill.items?.length || 0})</Text>
            <TouchableOpacity testID="toggle-add-item" onPress={() => setShowAddItem(!showAddItem)}>
              <Ionicons name={showAddItem ? 'close-circle' : 'add-circle'} size={24} color={Colors.primary} />
            </TouchableOpacity>
          </View>
          {showAddItem && (
            <View style={styles.addRow}>
              <TextInput testID="new-item-name" style={[styles.addInput, { flex: 2 }]} placeholder="Item name" placeholderTextColor={Colors.muted} value={newItemName} onChangeText={setNewItemName} />
              <TextInput testID="new-item-price" style={[styles.addInput, { flex: 1 }]} placeholder="Price" placeholderTextColor={Colors.muted} value={newItemPrice} onChangeText={setNewItemPrice} keyboardType="decimal-pad" />
              <TouchableOpacity testID="confirm-add-item" style={styles.addConfirmBtn} onPress={handleAddItem}>
                <Ionicons name="checkmark" size={20} color={Colors.primaryForeground} />
              </TouchableOpacity>
            </View>
          )}
          {bill.items?.map((item: any) => (
            <View key={item.item_id}>
              <View style={styles.itemRow}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemQty}>x{item.quantity}</Text>
                </View>
                <View style={styles.itemActions}>
                  <Text style={styles.itemPrice}>{bill.currency} {((item.price * item.quantity) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                  {bill.split_method === 'per_item' && (
                    <TouchableOpacity testID={`edit-item-${item.item_id}`} onPress={() => handleEditItemAssignedTo(item.item_id, item.assigned_to || [])} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="people-outline" size={18} color={Colors.primary} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity testID={`delete-item-${item.item_id}`} onPress={() => handleDeleteItem(item.item_id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle-outline" size={18} color={Colors.muted} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Show assigned participants if split by item */}
              {bill.split_method === 'per_item' && item.assigned_to && item.assigned_to.length > 0 && (
                <View style={styles.itemAssignedInfo}>
                  <Text style={styles.assignedInfoLabel}>Split among:</Text>
                  <View style={styles.assignedInfoTags}>
                    {item.assigned_to.map((participantId: string) => {
                      const participant = bill.participants.find((p: any) => p.participant_id === participantId);
                      return participant ? (
                        <View key={participantId} style={styles.assignedTag}>
                          <Text style={styles.assignedTagText}>{participant.name}</Text>
                        </View>
                      ) : null;
                    })}
                  </View>
                </View>
              )}

              {/* Editing mode - select participants */}
              {editingItemId === item.item_id && (
                <View style={styles.itemEditSection}>
                  <Text style={styles.editSectionTitle}>Select who pays for this item:</Text>
                  {bill.participants?.map((participant: any) => (
                    <TouchableOpacity
                      key={participant.participant_id}
                      style={styles.participantCheckRow}
                      onPress={() => handleToggleParticipantForItem(participant.participant_id)}
                    >
                      <View style={styles.checkboxContainer}>
                        <View style={[styles.checkbox, editingItemAssignedTo.includes(participant.participant_id) && styles.checkboxChecked]}>
                          {editingItemAssignedTo.includes(participant.participant_id) && (
                            <Ionicons name="checkmark" size={14} color={Colors.white} />
                          )}
                        </View>
                      </View>
                      <Text style={styles.participantCheckLabel}>{participant.name}</Text>
                    </TouchableOpacity>
                  ))}
                  <View style={styles.editActionRow}>
                    <TouchableOpacity style={[styles.editBtn, styles.editBtnCancel]} onPress={() => setEditingItemId(null)}>
                      <Text style={styles.editBtnText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.editBtn, styles.editBtnSave]} onPress={handleSaveItemAssignedTo}>
                      <Text style={[styles.editBtnText, { color: Colors.primaryForeground }]}>Save</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Participants Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>People ({bill.participants?.length || 0})</Text>
            <TouchableOpacity testID="toggle-add-person" onPress={() => setShowAddPerson(!showAddPerson)}>
              <Ionicons name={showAddPerson ? 'close-circle' : 'person-add'} size={24} color={Colors.primary} />
            </TouchableOpacity>
          </View>
          {showAddPerson && (
            <View style={styles.addRow}>
              <TextInput testID="new-person-name" style={[styles.addInput, { flex: 1 }]} placeholder="Person name" placeholderTextColor={Colors.muted} value={newPersonName} onChangeText={setNewPersonName} />
              <TouchableOpacity testID="confirm-add-person" style={styles.addConfirmBtn} onPress={handleAddPerson}>
                <Ionicons name="checkmark" size={20} color={Colors.primaryForeground} />
              </TouchableOpacity>
            </View>
          )}
          {bill.participants?.map((p: any) => (
            <View key={p.participant_id} style={styles.personRow}>
              <View style={styles.personAvatar}>
                <Text style={styles.personAvatarText}>{p.name[0].toUpperCase()}</Text>
              </View>
              <View style={styles.personInfo}>
                <Text style={styles.personName}>{p.name}{p.is_owner ? ' (You)' : ''}</Text>
              </View>
              {!p.is_owner && (
                <TouchableOpacity testID={`remove-person-${p.participant_id}`} onPress={() => handleRemovePerson(p.participant_id)}>
                  <Ionicons name="close-circle-outline" size={20} color={Colors.error} />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>

        {/* Split Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Split Breakdown</Text>
          </View>
          <View style={styles.splitMethodRow}>
            {['equal', 'per_item'].map(m => (
              <TouchableOpacity key={m} testID={`change-split-${m}`} style={[styles.splitMethodChip, bill.split_method === m && styles.splitMethodChipActive]} onPress={() => handleChangeSplitMethod(m)}>
                <Text style={[styles.splitMethodChipText, bill.split_method === m && styles.splitMethodChipTextActive]}>
                  {m === 'equal' ? 'Equal' : 'By Item'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Items breakdown when split by item */}
          {bill.split_method === 'per_item' && bill.items && bill.items.length > 0 && (
            <View style={styles.itemsBreakdownSection}>
              <Text style={styles.itemsBreakdownTitle}>Items Breakdown</Text>
              {bill.items.map((item: any) => {
                const assignedParticipants = item.assigned_to && item.assigned_to.length > 0 
                  ? bill.participants.filter((p: any) => item.assigned_to.includes(p.participant_id))
                  : bill.participants;
                
                const itemTotal = item.price * item.quantity;
                const perPersonAmount = assignedParticipants.length > 0 ? itemTotal / assignedParticipants.length : 0;

                return (
                  <View key={item.item_id} style={styles.itemBreakdownCard}>
                    <View style={styles.itemBreakdownHeader}>
                      <View style={styles.itemBreakdownInfo}>
                        <Text style={styles.itemBreakdownName}>{item.name}</Text>
                        <Text style={styles.itemBreakdownQty}>x{item.quantity} @ {bill.currency} {item.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                      </View>
                      <Text style={styles.itemBreakdownTotal}>{bill.currency} {itemTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                    </View>
                    
                    <View style={styles.itemAssignedTo}>
                      <Text style={styles.assignedLabel}>Split among:</Text>
                      {assignedParticipants.map((p: any) => (
                        <View key={p.participant_id} style={styles.assignedPersonRow}>
                          <View style={styles.assignedPersonAvatar}>
                            <Text style={styles.assignedPersonAvatarText}>{p.name[0].toUpperCase()}</Text>
                          </View>
                          <Text style={styles.assignedPersonName}>{p.name}</Text>
                          <Text style={styles.assignedPersonAmount}>{bill.currency} {perPersonAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Summary splits */}
          <View style={bill.split_method === 'per_item' && bill.items && bill.items.length > 0 ? styles.splitSummarySection : {}}>
            <Text style={bill.split_method === 'per_item' && bill.items && bill.items.length > 0 ? styles.splitSummaryTitle : { display: 'none' }}>
              Total Per Person
            </Text>
            {bill.splits?.map((split: any) => (
              <TouchableOpacity
                key={split.participant_id}
                testID={`split-${split.participant_id}`}
                style={styles.splitCard}
                onPress={() => handleTogglePayment(split)}
                activeOpacity={0.7}
              >
                <View style={styles.splitLeft}>
                  <View style={[styles.splitAvatar, split.status === 'paid' && styles.splitAvatarPaid]}>
                    <Text style={styles.splitAvatarText}>{split.participant_name?.[0]?.toUpperCase() || '?'}</Text>
                  </View>
                  <View>
                    <Text style={styles.splitName}>{split.participant_name}</Text>
                    <Text style={[styles.splitStatus, { color: split.status === 'paid' ? Colors.success : Colors.warning }]}>
                      {split.status === 'paid' ? 'Paid' : 'Unpaid'}
                    </Text>
                  </View>
                </View>
                <View style={styles.splitRight}>
                  <Text style={styles.splitAmount}>{bill.currency} {(split.amount_due || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                  <View style={[styles.paymentToggle, split.status === 'paid' && styles.paymentTogglePaid]}>
                    <Ionicons name={split.status === 'paid' ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={split.status === 'paid' ? Colors.success : Colors.muted} />
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 12 },
  topBarActions: { flexDirection: 'row', gap: 12 },
  topBarBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 32 },
  billHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  billTitle: { fontSize: 28, fontWeight: '700', color: Colors.white, letterSpacing: -0.5, flex: 1, marginRight: 12 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100 },
  statusText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  totalCard: { backgroundColor: Colors.surface, borderRadius: 24, padding: 24, marginBottom: 24, borderWidth: 1, borderColor: Colors.primary + '30' },
  totalLabel: { fontSize: 13, fontWeight: '500', color: Colors.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' },
  totalAmount: { fontSize: 36, fontWeight: '800', color: Colors.primary, letterSpacing: -1.5, marginTop: 4 },
  totalBreakdown: { flexDirection: 'row', gap: 24, marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: Colors.border },
  breakdownItem: { gap: 2 },
  breakdownLabel: { fontSize: 12, color: Colors.textMuted },
  breakdownValue: { fontSize: 16, fontWeight: '600', color: Colors.white },
  progressContainer: { marginTop: 16, gap: 8 },
  progressBar: { height: 8, borderRadius: 4, backgroundColor: Colors.surfaceHighlight },
  progressFill: { height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  progressText: { fontSize: 13, color: Colors.textMuted, fontWeight: '500' },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 20, fontWeight: '600', color: Colors.white, letterSpacing: -0.25 },
  addRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  addInput: { backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, height: 48, paddingHorizontal: 14, color: Colors.white, fontSize: 15 },
  addConfirmBtn: { width: 48, height: 48, borderRadius: 12, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  itemInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  itemName: { fontSize: 16, fontWeight: '500', color: Colors.white },
  itemQty: { fontSize: 13, color: Colors.textMuted },
  itemActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  itemPrice: { fontSize: 16, fontWeight: '600', color: Colors.white },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  personAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceHighlight, justifyContent: 'center', alignItems: 'center' },
  personAvatarText: { fontSize: 16, fontWeight: '600', color: Colors.white },
  personInfo: { flex: 1 },
  personName: { fontSize: 16, fontWeight: '500', color: Colors.white },
  splitMethodRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  splitMethodChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 100, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  splitMethodChipActive: { backgroundColor: Colors.primary + '20', borderColor: Colors.primary },
  splitMethodChipText: { fontSize: 14, fontWeight: '500', color: Colors.muted },
  splitMethodChipTextActive: { color: Colors.primary },
  splitCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 16, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  splitLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  splitAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.surfaceHighlight, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.border },
  splitAvatarPaid: { borderColor: Colors.success },
  splitAvatarText: { fontSize: 16, fontWeight: '600', color: Colors.white },
  splitName: { fontSize: 16, fontWeight: '600', color: Colors.white },
  splitStatus: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  splitRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  splitAmount: { fontSize: 18, fontWeight: '700', color: Colors.white },
  paymentToggle: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  paymentTogglePaid: { backgroundColor: Colors.success + '20' },
  itemsBreakdownSection: { marginBottom: 24, paddingBottom: 24, borderBottomWidth: 1, borderBottomColor: Colors.border },
  itemsBreakdownTitle: { fontSize: 16, fontWeight: '600', color: Colors.white, marginBottom: 16 },
  itemBreakdownCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  itemBreakdownHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  itemBreakdownInfo: { flex: 1, marginRight: 12 },
  itemBreakdownName: { fontSize: 16, fontWeight: '600', color: Colors.white, marginBottom: 4 },
  itemBreakdownQty: { fontSize: 13, color: Colors.textMuted },
  itemBreakdownTotal: { fontSize: 16, fontWeight: '700', color: Colors.primary },
  itemAssignedTo: { gap: 8 },
  assignedLabel: { fontSize: 12, fontWeight: '600', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  assignedPersonRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  assignedPersonAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.surfaceHighlight, justifyContent: 'center', alignItems: 'center' },
  assignedPersonAvatarText: { fontSize: 13, fontWeight: '600', color: Colors.white },
  assignedPersonName: { flex: 1, fontSize: 14, fontWeight: '500', color: Colors.white },
  assignedPersonAmount: { fontSize: 14, fontWeight: '600', color: Colors.primary },
  splitSummarySection: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: Colors.border },
  splitSummaryTitle: { fontSize: 14, fontWeight: '600', color: Colors.textMuted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  itemAssignedInfo: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: Colors.surfaceHighlight + '40', borderRadius: 12, marginBottom: 12 },
  assignedInfoLabel: { fontSize: 11, fontWeight: '600', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  assignedInfoTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  assignedTag: { backgroundColor: Colors.primary + '30', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: Colors.primary + '60' },
  assignedTagText: { fontSize: 12, fontWeight: '500', color: Colors.primary },
  itemEditSection: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 8 },
  editSectionTitle: { fontSize: 13, fontWeight: '600', color: Colors.white, marginBottom: 12 },
  participantCheckRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border + '40' },
  checkboxContainer: { marginRight: 12 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  checkboxChecked: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  participantCheckLabel: { fontSize: 14, fontWeight: '500', color: Colors.white, flex: 1 },
  editActionRow: { flexDirection: 'row', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  editBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  editBtnCancel: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  editBtnSave: { backgroundColor: Colors.primary },
  editBtnText: { fontSize: 13, fontWeight: '600', color: Colors.white },
});
