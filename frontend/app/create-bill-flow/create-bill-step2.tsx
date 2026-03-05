/**
 * Step 2: Basic Information
 * File: frontend/app/(tabs)/create-bill-step2.tsx
 * 
 * User enters:
 * - Bill title/name (max 200 characters)
 * - Currency (IDR, USD, SGD, MYR, THB, PHP, VND)
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
  Platform,
} from 'react-native';
import { useSplitBill } from '../../contexts/SplitBillContext';
import { validateTitle, validateCurrency } from '../../utils/splitBillValidation';

interface Step2Props {
  onNext: () => void;
  onPrevious: () => void;
}

const CURRENCIES = ['IDR', 'USD', 'SGD', 'MYR', 'THB', 'PHP', 'VND'];

const Step2BasicInfo: React.FC<Step2Props> = ({ onNext, onPrevious }) => {
  const { form, setTitle, setCurrency } = useSplitBill();
  const [localTitle, setLocalTitle] = useState(form.title);
  const [titleError, setTitleError] = useState('');
  const [currencyError, setCurrencyError] = useState('');
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);

  const handleTitleChange = (text: string) => {
    setLocalTitle(text);
    setTitleError('');
  };

  const handleNext = () => {
    // Validate title
    const titleValidation = validateTitle(localTitle);
    if (!titleValidation.valid) {
      setTitleError(titleValidation.error || 'Invalid title');
      return;
    }

    // Validate currency
    const currencyValidation = validateCurrency(form.currency);
    if (!currencyValidation.valid) {
      setCurrencyError(currencyValidation.error || 'Invalid currency');
      return;
    }

    // Update context and proceed
    setTitle(localTitle);
    onNext();
  };

  const handleCurrencySelect = (currency: string) => {
    setCurrency(currency);
    setCurrencyError('');
    setShowCurrencyPicker(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.stepNumber}>Step 2 of 6</Text>
        <Text style={styles.title}>Bill Information</Text>
        <Text style={styles.subtitle}>Enter basic details about this bill</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Title Input */}
        <View style={styles.section}>
          <View style={styles.labelContainer}>
            <Text style={styles.label}>Bill Name *</Text>
            <Text style={styles.charCount}>
              {localTitle.length}/200
            </Text>
          </View>
          <TextInput
            style={[styles.input, titleError && styles.inputError]}
            placeholder="e.g., Dinner at Restaurant X"
            placeholderTextColor="#ccc"
            value={localTitle}
            onChangeText={handleTitleChange}
            maxLength={200}
          />
          {titleError && (
            <Text style={styles.errorText}>{titleError}</Text>
          )}
        </View>

        {/* Currency Selection */}
        <View style={styles.section}>
          <Text style={styles.label}>Currency *</Text>
          <TouchableOpacity
            style={[styles.currencyButton, currencyError && styles.inputError]}
            onPress={() => setShowCurrencyPicker(!showCurrencyPicker)}
          >
            <Text style={styles.currencyButtonText}>{form.currency}</Text>
            <Text style={styles.currencyButtonArrow}>▼</Text>
          </TouchableOpacity>
          {currencyError && (
            <Text style={styles.errorText}>{currencyError}</Text>
          )}

          {/* Currency Picker */}
          {showCurrencyPicker && (
            <View style={styles.currencyPicker}>
              {CURRENCIES.map(currency => (
                <TouchableOpacity
                  key={currency}
                  style={[
                    styles.currencyOption,
                    form.currency === currency && styles.currencyOptionSelected,
                  ]}
                  onPress={() => handleCurrencySelect(currency)}
                >
                  <Text
                    style={[
                      styles.currencyOptionText,
                      form.currency === currency && styles.currencyOptionTextSelected,
                    ]}
                  >
                    {currency}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Text style={styles.infoIcon}>ℹ️</Text>
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Tip</Text>
            <Text style={styles.infoText}>
              Give your bill a descriptive name to keep track of it. You can update currency later if needed.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Footer with Navigation */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.backButton} onPress={onPrevious}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.nextButton,
            (!localTitle || titleError) && styles.nextButtonDisabled,
          ]}
          onPress={handleNext}
          disabled={!localTitle || !!titleError}
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
    paddingVertical: 20,
  },
  section: {
    marginBottom: 20,
  },
  labelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  charCount: {
    fontSize: 12,
    color: '#999',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#000',
    backgroundColor: '#fafafa',
  },
  inputError: {
    borderColor: '#d32f2f',
    backgroundColor: '#ffebee',
  },
  errorText: {
    fontSize: 12,
    color: '#d32f2f',
    marginTop: 4,
  },
  currencyButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fafafa',
  },
  currencyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  currencyButtonArrow: {
    fontSize: 12,
    color: '#999',
  },
  currencyPicker: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginTop: 8,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  currencyOption: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  currencyOptionSelected: {
    backgroundColor: '#e8f5e9',
  },
  currencyOptionText: {
    fontSize: 16,
    color: '#666',
  },
  currencyOptionTextSelected: {
    color: '#4caf50',
    fontWeight: '600',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    padding: 12,
    marginTop: 20,
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
    color: '#1565c0',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 13,
    color: '#1565c0',
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
});

export default Step2BasicInfo;
