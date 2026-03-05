/**
 * Step 1: Input Method Selection
 * File: frontend/app/(tabs)/create-bill-step1.tsx
 * 
 * User chooses how to create a bill:
 * - MANUAL: Type in bill details manually
 * - PHOTO: Scan receipt using OCR (if available)
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { useSplitBill } from '../../contexts/SplitBillContext';

interface Step1Props {
  onNext: () => void;
}

const Step1InputMethod: React.FC<Step1Props> = ({ onNext }) => {
  const { form, setInputMethod } = useSplitBill();

  const handleSelect = (method: 'MANUAL' | 'PHOTO') => {
    setInputMethod(method);
    onNext();
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.stepNumber}>Step 1 of 6</Text>
        <Text style={styles.title}>How do you want to create this bill?</Text>
        <Text style={styles.subtitle}>
          Choose between manual entry or scanning a receipt
        </Text>
      </View>

      {/* Options Container */}
      <View style={styles.optionsContainer}>
        {/* Manual Option */}
        <TouchableOpacity
          style={[
            styles.optionCard,
            form.inputMethod === 'MANUAL' && styles.optionCardSelected,
          ]}
          onPress={() => handleSelect('MANUAL')}
        >
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>✏️</Text>
          </View>
          <Text style={styles.optionTitle}>Manual Entry</Text>
          <Text style={styles.optionDescription}>
            Type in the bill details manually
          </Text>
          <Text style={styles.optionFeatures}>
            • Full control over details{'\n'}
            • No OCR errors{'\n'}
            • Great for custom splits
          </Text>
        </TouchableOpacity>

        {/* Photo/OCR Option */}
        <TouchableOpacity
          style={[
            styles.optionCard,
            form.inputMethod === 'PHOTO' && styles.optionCardSelected,
          ]}
          onPress={() => handleSelect('PHOTO')}
        >
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>📸</Text>
          </View>
          <Text style={styles.optionTitle}>Scan Receipt (OCR)</Text>
          <Text style={styles.optionDescription}>
            Take a photo of your receipt
          </Text>
          <Text style={styles.optionFeatures}>
            • Auto-extract items{'\n'}
            • Fast data entry{'\n'}
            • Edit as needed
          </Text>
        </TouchableOpacity>
      </View>

      {/* Footer Info */}
      <View style={styles.footer}>
        <Text style={styles.infoText}>
          You can change this later if needed
        </Text>
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
    paddingVertical: 24,
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
    marginTop: 12,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  optionsContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
    justifyContent: 'center',
  },
  optionCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  optionCardSelected: {
    backgroundColor: '#e8f5e9',
    borderColor: '#4caf50',
  },
  iconContainer: {
    marginBottom: 12,
  },
  icon: {
    fontSize: 40,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  optionFeatures: {
    fontSize: 12,
    color: '#999',
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  infoText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
});

export default Step1InputMethod;
