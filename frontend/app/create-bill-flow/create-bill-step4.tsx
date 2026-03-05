/**
 * Step 4: Participants Management
 * File: frontend/app/(tabs)/create-bill-step4.tsx
 * 
 * User adds participants (people who will share the bill)
 * - Requires at least 2 participants
 * - Prevents duplicate names
 * - Shows count of participants
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
import { validateParticipants } from '../../utils/splitBillValidation';

interface Step4Props {
  onNext: () => void;
  onPrevious: () => void;
}

const Step4Participants: React.FC<Step4Props> = ({ onNext, onPrevious }) => {
  const { form, addParticipant, removeParticipant } = useSplitBill();
  const [participantName, setParticipantName] = useState('');
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  const handleAddParticipant = () => {
    const name = participantName.trim();

    if (!name) {
      setError('Participant name is required');
      return;
    }

    // Check for duplicates
    if (form.participants.some(p => p.name.toLowerCase() === name.toLowerCase())) {
      setError('This participant already exists');
      return;
    }

    addParticipant(name);
    setParticipantName('');
    setError('');
    setShowAddModal(false);
  };

  const handleNext = () => {
    const validation = validateParticipants(form.participants);
    if (!validation.valid) {
      setError(validation.error || 'Please add at least 2 participants');
      return;
    }
    onNext();
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.stepNumber}>Step 4 of 6</Text>
        <Text style={styles.title}>Participants</Text>
        <Text style={styles.subtitle}>Who is sharing this bill?</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Participants Count */}
        <View style={styles.countBox}>
          <View style={styles.countTextContainer}>
            <Text style={styles.countLabel}>Total Participants</Text>
            <Text style={styles.countNumber}>{form.participants.length}</Text>
          </View>
          <Text style={styles.countIcon}>👥</Text>
        </View>

        {/* Participants List */}
        {form.participants.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>😴</Text>
            <Text style={styles.emptyStateText}>No participants yet</Text>
            <Text style={styles.emptyStateSubtext}>
              Add at least 2 people to share this bill
            </Text>
          </View>
        ) : (
          <View style={styles.participantsList}>
            {form.participants.map((participant, index) => (
              <View key={participant.id} style={styles.participantCard}>
                <View style={styles.participantInfo}>
                  <View style={styles.participantBadge}>
                    <Text style={styles.participantBadgeText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.participantName}>{participant.name}</Text>
                </View>
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removeParticipant(participant.id)}
                >
                  <Text style={styles.removeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Add Button */}
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            setError('');
            setShowAddModal(true);
          }}
        >
          <Text style={styles.addButtonText}>+ Add Participant</Text>
        </TouchableOpacity>

        {error && <Text style={styles.errorText}>{error}</Text>}

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Text style={styles.infoIcon}>💡</Text>
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Tip</Text>
            <Text style={styles.infoText}>
              You can add yourself and other friends or colleagues. You don't need to use
              real names - nicknames work too!
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.backButton} onPress={onPrevious}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.nextButton,
            form.participants.length < 2 && styles.nextButtonDisabled,
          ]}
          onPress={handleNext}
          disabled={form.participants.length < 2}
        >
          <Text style={styles.nextButtonText}>Next →</Text>
        </TouchableOpacity>
      </View>

      {/* Add Participant Modal */}
      <Modal
        visible={showAddModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Participant</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Text style={styles.modalCloseButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalLabel}>Participant Name *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g., John, Andi, or You"
                placeholderTextColor="#ccc"
                value={participantName}
                onChangeText={text => {
                  setParticipantName(text);
                  setError('');
                }}
                maxLength={50}
                autoFocus
              />

              {error && <Text style={styles.errorText}>{error}</Text>}

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => {
                    setShowAddModal(false);
                    setParticipantName('');
                    setError('');
                  }}
                >
                  <Text style={styles.modalCancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalAddButton}
                  onPress={handleAddParticipant}
                >
                  <Text style={styles.modalAddButtonText}>Add</Text>
                </TouchableOpacity>
              </View>
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
  countBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#e3f2fd',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 20,
  },
  countTextContainer: {
    flex: 1,
  },
  countLabel: {
    fontSize: 12,
    color: '#1565c0',
    marginBottom: 4,
  },
  countNumber: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1565c0',
  },
  countIcon: {
    fontSize: 40,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginBottom: 16,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  emptyStateSubtext: {
    fontSize: 13,
    color: '#999',
  },
  participantsList: {
    marginBottom: 16,
  },
  participantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginBottom: 8,
  },
  participantInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  participantBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4caf50',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  participantBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  participantName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
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
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
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
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  infoIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#856404',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 13,
    color: '#856404',
    lineHeight: 18,
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
    paddingVertical: 20,
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
    paddingVertical: 12,
    fontSize: 16,
    color: '#000',
    backgroundColor: '#fafafa',
    marginBottom: 16,
  },
  modalFooter: {
    flexDirection: 'row',
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

export default Step4Participants;
