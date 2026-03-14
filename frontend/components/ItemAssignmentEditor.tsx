import React, { memo, useMemo } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../utils/colors';

type Participant = {
  participant_id: string;
  name: string;
};

type ItemAssignmentEditorProps = {
  title?: string;
  participants: Participant[];
  assignments: Record<string, number>;
  unitPrice: number;
  currency: string;
  itemQuantity: number;
  assignedTotal: number;
  remainingQuantity: number;
  warning: string;
  onAdjust: (participantId: string, delta: number) => void;
  onInputChange: (participantId: string, text: string) => void;
  onCancel?: () => void;
  onSave?: () => void;
  saveDisabled?: boolean;
  showActions?: boolean;
};

function ItemAssignmentEditorComponent({
  title,
  participants,
  assignments,
  unitPrice,
  currency,
  itemQuantity,
  assignedTotal,
  remainingQuantity,
  warning,
  onAdjust,
  onInputChange,
  onCancel,
  onSave,
  saveDisabled = false,
  showActions = true,
}: ItemAssignmentEditorProps) {
  const costByParticipant = useMemo(() => {
    const costs: Record<string, number> = {};
    participants.forEach((participant) => {
      const qty = assignments[participant.participant_id] || 0;
      costs[participant.participant_id] = qty * unitPrice;
    });
    return costs;
  }, [participants, assignments, unitPrice]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title || 'Assign units for each participant:'}</Text>
      <View style={styles.summaryRow}>
        <Text style={styles.summaryText}>Assigned: {assignedTotal} / {itemQuantity}</Text>
        <Text style={[styles.summaryText, assignedTotal === itemQuantity ? styles.validText : styles.invalidText]}>
          {assignedTotal === itemQuantity ? 'Valid' : 'Needs adjustment'}
        </Text>
      </View>
      <Text style={[styles.remainingText, remainingQuantity === 0 ? styles.remainingOk : styles.remainingWarn]}>
        Remaining: {remainingQuantity} / {itemQuantity}
      </Text>
      {warning ? <Text style={styles.warningText}>{warning}</Text> : null}

      {participants.map((participant) => (
        <View key={participant.participant_id} style={styles.row}>
          <Text style={styles.participantLabel}>{participant.name}</Text>
          <View style={styles.qtyAdjuster}>
            <TouchableOpacity style={styles.qtyBtn} onPress={() => onAdjust(participant.participant_id, -1)}>
              <Ionicons name="remove" size={14} color={Colors.white} />
            </TouchableOpacity>
            <TextInput
              style={styles.qtyInput}
              value={String(assignments[participant.participant_id] || 0)}
              onChangeText={(text) => onInputChange(participant.participant_id, text)}
              keyboardType="number-pad"
              maxLength={4}
            />
            <TouchableOpacity style={styles.qtyBtn} onPress={() => onAdjust(participant.participant_id, 1)}>
              <Ionicons name="add" size={14} color={Colors.white} />
            </TouchableOpacity>
          </View>
          <Text style={styles.rowCostPreview}>
            {currency} {costByParticipant[participant.participant_id].toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        </View>
      ))}

      {showActions && (
        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.actionBtn, styles.cancelBtn]} onPress={onCancel}>
            <Text style={styles.actionBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.saveBtn, saveDisabled && styles.saveBtnDisabled]}
            onPress={onSave}
            disabled={saveDisabled}
          >
            <Text style={[styles.actionBtnText, { color: Colors.primaryForeground }]}>Save</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export const ItemAssignmentEditor = memo(ItemAssignmentEditorComponent);

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 8 },
  title: { fontSize: 13, fontWeight: '600', color: Colors.white, marginBottom: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  summaryText: { fontSize: 12, color: Colors.textMuted, fontWeight: '600' },
  validText: { color: Colors.success },
  invalidText: { color: Colors.warning },
  remainingText: { fontSize: 12, fontWeight: '600', marginBottom: 8 },
  remainingOk: { color: Colors.success },
  remainingWarn: { color: Colors.warning },
  warningText: { fontSize: 12, color: Colors.warning, marginBottom: 8, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border + '40' },
  participantLabel: { fontSize: 14, fontWeight: '500', color: Colors.white, flex: 1 },
  qtyAdjuster: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qtyBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.surfaceHighlight, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  qtyInput: { width: 44, height: 30, borderRadius: 6, borderWidth: 1, borderColor: Colors.border, color: Colors.white, textAlign: 'center', fontSize: 14, fontWeight: '700', backgroundColor: Colors.background },
  rowCostPreview: { width: 92, textAlign: 'right', fontSize: 12, fontWeight: '700', color: Colors.primary, marginLeft: 10 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  actionBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  cancelBtn: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  saveBtn: { backgroundColor: Colors.primary },
  saveBtnDisabled: { opacity: 0.45 },
  actionBtnText: { fontSize: 13, fontWeight: '600', color: Colors.white },
});
