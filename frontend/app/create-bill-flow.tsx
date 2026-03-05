/**
 * Create Bill Flow - Main Orchestrator Component
 * File: frontend/app/create-bill-flow.tsx
 * 
 * This is the main component that manages the 7-step create bill flow.
 * It handles navigation between steps and manages overall form state.
 */

import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { SplitBillProvider } from '../contexts/SplitBillContext';
import Step1InputMethod from './create-bill-flow/create-bill-step1';
import Step2BasicInfo from './create-bill-flow/create-bill-step2';
import Step3BillDetails from './create-bill-flow/create-bill-step3';
import Step4Participants from './create-bill-flow/create-bill-step4';
import Step5SplitMethod from './create-bill-flow/create-bill-step5';
import Step6Review from './create-bill-flow/create-bill-step6';

type StepNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;

const CreateBillFlow: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<StepNumber>(1);

  const handleNext = () => {
    if (currentStep < 7) {
      setCurrentStep((currentStep + 1) as StepNumber);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as StepNumber);
    }
  };

  const handleGoToStep = (step: StepNumber) => {
    setCurrentStep(step);
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <Step1InputMethod onNext={handleNext} />;
      case 2:
        return (
          <Step2BasicInfo
            onNext={handleNext}
            onPrevious={handlePrevious}
          />
        );
      case 3:
        return (
          <Step3BillDetails
            onNext={handleNext}
            onPrevious={handlePrevious}
          />
        );
      case 4:
        return (
          <Step4Participants
            onNext={handleNext}
            onPrevious={handlePrevious}
          />
        );
      case 5:
        return (
          <Step5SplitMethod
            onNext={handleNext}
            onPrevious={handlePrevious}
          />
        );
      case 6:
        return (
          <Step6Review
            onNext={handleNext}
            onPrevious={handlePrevious}
          />
        );
      default:
        return null;
    }
  };

  return (
    <SplitBillProvider>
      <View style={styles.container}>
        {renderStep()}
      </View>
    </SplitBillProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default CreateBillFlow;
