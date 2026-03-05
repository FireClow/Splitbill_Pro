/**
 * Step 5: Split Method Selection (SIMPLIFIED)
 * Priority: Split by Item feature
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useSplitBill } from '../../contexts/SplitBillContext';
import ItemAssignmentUI from './ItemAssignmentUI';

interface Step5Props {
  onNext: () => void;
  onPrevious: () => void;
}

const Step5SplitMethod: React.FC<Step5Props> = ({ onNext, onPrevious }) => {
  const { form, setSplitMethod } = useSplitBill();
  const [showItemAssignment, setShowItemAssignment] = useState(false);

  // ALERT when component mounts
  React.useEffect(() => {
    console.log('🎯 [Step5] Component MOUNTED - items:', form.items.length, 'participants:', form.participants.length);
  }, []);

  console.log('📋 [Step5] Render - splitMethod:', form.splitMethod, 'showItemAssignment:', showItemAssignment);

  // MAIN LOGIC: Show ItemAssignmentUI when user selects item assignment
  if (showItemAssignment) {
    console.log('✅ [Step5] RENDERING ItemAssignmentUI - items:', form.items.length, 'participants:', form.participants.length);
    return (
      <ItemAssignmentUI
        onNext={onNext}
        onPrevious={() => {
          console.log('🔙 [Step5] User clicked back from ItemAssignmentUI');
          setShowItemAssignment(false);
        }}
      />
    );
  }

  // METHOD SELECTION SCREEN
  const handleSelectMethod = (method: 'EQUAL' | 'ITEM' | 'PERCENTAGE' | 'CUSTOM') => {
    console.log('🔀 [Step5] Selected method:', method);
    console.log('📦 [Step5] Items available:', form.items.length);
    console.log('👥 [Step5] Participants available:', form.participants.length);
    
    setSplitMethod(method);

    if (method === 'EQUAL') {
      // EQUAL split: go straight to next step
      onNext();
    } else if (method === 'ITEM') {
      // ITEM split: show assignment UI
      console.log('🔀 [Step5] ITEM selected - setting showItemAssignment to TRUE');
      setShowItemAssignment(true);
      alert('✅ Split by Item clicked! showItemAssignment will be set to true');
    } else if (method === 'PERCENTAGE') {
      // For now, just go to next
      onNext();
    } else if (method === 'CUSTOM') {
      // For now, just go to next
      onNext();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* BIG RED DEBUG BANNER */}
      <View style={{
        backgroundColor: '#ff0000',
        padding: 16,
        margin: 0,
        borderRadius: 0,
      }}>
        <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#fff', marginBottom: 8, textAlign: 'center' }}>
          🔍 STEP 5 DEBUG STATE
        </Text>
        <Text style={{ fontSize: 14, color: '#fff', marginBottom: 4, textAlign: 'center' }}>
          showItemAssignment: {String(showItemAssignment)} {showItemAssignment ? '✅' : '❌'}
        </Text>
        <Text style={{ fontSize: 14, color: '#fff', marginBottom: 4, textAlign: 'center' }}>
          splitMethod: {form.splitMethod || 'NOT SET'}
        </Text>
        <Text style={{ fontSize: 14, color: '#fff', marginBottom: 8, textAlign: 'center' }}>
          Items: {form.items.length} | Participants: {form.participants.length}
        </Text>
        <TouchableOpacity
          style={{
            backgroundColor: '#ffd700',
            padding: 10,
            borderRadius: 6,
            marginBottom: 6,
          }}
          onPress={() => {
            console.log('CLICKED: Force setShowItemAssignment = true');
            setShowItemAssignment(true);
          }}
        >
          <Text style={{ color: '#000', fontSize: 13, fontWeight: 'bold', textAlign: 'center' }}>
            🔧 FORCE SHOW ItemAssignmentUI
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{
            backgroundColor: '#fff',
            padding: 10,
            borderRadius: 6,
          }}
          onPress={() => {
            alert(`State: showItemAssignment=${showItemAssignment}, splitMethod=${form.splitMethod}, items=${form.items.length}`);
          }}
        >
          <Text style={{ color: '#000', fontSize: 13, fontWeight: 'bold', textAlign: 'center' }}>
            📊 Show State Alert
          </Text>
        </TouchableOpacity>
      </View>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.stepNumber}>Step 5 of 6</Text>
        <Text style={styles.title}>How to Split?</Text>
        <Text style={styles.subtitle}>Choose a splitting method</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* EQUAL SPLIT */}
        <TouchableOpacity
          style={[
            styles.methodButton,
            form.splitMethod === 'EQUAL' && styles.methodButtonSelected,
          ]}
          onPress={() => handleSelectMethod('EQUAL')}
        >
          <View style={styles.methodContent}>
            <Text style={styles.methodIcon}>➗</Text>
            <View style={styles.methodTextContainer}>
              <Text style={styles.methodTitle}>Equal Split</Text>
              <Text style={styles.methodDescription}>
                Split equally among {form.participants.length} people
              </Text>
            </View>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        {/* SPLIT BY ITEM - MAIN PRIORITY */}
        <TouchableOpacity
          style={[
            styles.methodButton,
            form.splitMethod === 'ITEM' && styles.methodButtonSelected,
          ]}
          onPress={() => handleSelectMethod('ITEM')}
        >
          <View style={styles.methodContent}>
            <Text style={styles.methodIcon}>🍽️</Text>
            <View style={styles.methodTextContainer}>
              <Text style={styles.methodTitle}>Split by Item</Text>
              <Text style={styles.methodDescription}>
                Assign items to participants ({form.items.length} items)
              </Text>
            </View>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        {/* PERCENTAGE - COMING SOON */}
        <TouchableOpacity
          style={[
            styles.methodButton,
            styles.methodButtonDisabled,
          ]}
          disabled={true}
        >
          <View style={styles.methodContent}>
            <Text style={styles.methodIcon}>📊</Text>
            <View style={styles.methodTextContainer}>
              <Text style={styles.methodTitle}>By Percentage</Text>
              <Text style={styles.methodDescription}>
                Coming soon
              </Text>
            </View>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        {/* CUSTOM - COMING SOON */}
        <TouchableOpacity
          style={[
            styles.methodButton,
            styles.methodButtonDisabled,
          ]}
          disabled={true}
        >
          <View style={styles.methodContent}>
            <Text style={styles.methodIcon}>💰</Text>
            <View style={styles.methodTextContainer}>
              <Text style={styles.methodTitle}>Custom Amounts</Text>
              <Text style={styles.methodDescription}>
                Coming soon
              </Text>
            </View>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onPrevious}
        >
          <Text style={styles.backButtonText}>← Back</Text>
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
    paddingVertical: 20,
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
    fontSize: 28,
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
    paddingHorizontal: 15,
    paddingVertical: 20,
  },
  methodButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  methodButtonSelected: {
    borderColor: '#d4ff00',
    backgroundColor: '#f9ff00',
    borderWidth: 2,
  },
  methodButtonDisabled: {
    opacity: 0.5,
  },
  methodContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  methodIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  methodTextContainer: {
    flex: 1,
  },
  methodTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  methodDescription: {
    fontSize: 13,
    color: '#666',
  },
  chevron: {
    fontSize: 24,
    color: '#999',
    marginLeft: 8,
  },
  footer: {
    paddingHorizontal: 15,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    flexDirection: 'row',
    gap: 12,
  },
  backButton: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
});

export default Step5SplitMethod;
