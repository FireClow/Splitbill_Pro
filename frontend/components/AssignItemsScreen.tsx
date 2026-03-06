import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../utils/colors';

export interface AssignableItem {
  id: string;
  name: string;
  price: string;
  quantity: string;
  assignedTo: string[];
}

export interface AssignableParticipant {
  id: string;
  name: string;
}

interface AssignItemsScreenProps {
  items: AssignableItem[];
  participants: AssignableParticipant[];
  currency: string;
  formatCurrency: (amount: number) => string;
  onToggleAssignment: (itemId: string, participantId: string) => void;
}

const AssignItemsScreen: React.FC<AssignItemsScreenProps> = ({
  items,
  participants,
  currency,
  formatCurrency,
  onToggleAssignment,
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Assign Items</Text>
      <Text style={styles.subtitle}>Select who consumed each item</Text>

      {items.length === 0 ? (
        <View style={styles.infoCard}>
          <Text style={styles.infoText}>Add items first before assigning.</Text>
        </View>
      ) : participants.length === 0 ? (
        <View style={styles.infoCard}>
          <Text style={styles.infoText}>Add participants first before assigning items.</Text>
        </View>
      ) : (
        items.map((item) => {
          const unitPrice = parseFloat(item.price) || 0;
          const quantity = Math.max(parseInt(item.quantity, 10) || 1, 1);
          const lineTotal = unitPrice * quantity;
          const hasAssignment = item.assignedTo.length > 0;

          return (
            <View key={item.id} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemMeta}>
                  x{quantity} - {currency} {formatCurrency(lineTotal)}
                </Text>
              </View>

              <View style={styles.peopleList}>
                {participants.map((participant) => {
                  const selected = item.assignedTo.includes(participant.id);
                  return (
                    <TouchableOpacity
                      key={participant.id}
                      style={[styles.personRow, selected && styles.personRowSelected]}
                      onPress={() => onToggleAssignment(item.id, participant.id)}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={selected ? 'checkbox' : 'square-outline'}
                        size={20}
                        color={selected ? Colors.primary : Colors.muted}
                      />
                      <Text style={[styles.personName, selected && styles.personNameSelected]}>
                        {participant.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {!hasAssignment && (
                <View style={styles.warningRow}>
                  <Ionicons name="alert-circle-outline" size={16} color={Colors.warning} />
                  <Text style={styles.warningText}>Please assign this item to at least one participant.</Text>
                </View>
              )}
            </View>
          );
        })
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.white,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textMuted,
    marginBottom: 8,
  },
  infoCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
  },
  infoText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  itemCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 10,
  },
  itemHeader: {
    marginBottom: 12,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  itemMeta: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  peopleList: {
    gap: 8,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
  },
  personRowSelected: {
    borderColor: Colors.primary,
    backgroundColor: `${Colors.primary}12`,
  },
  personName: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  personNameSelected: {
    color: Colors.white,
  },
  warningRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  warningText: {
    color: Colors.warning,
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
});

export default AssignItemsScreen;
