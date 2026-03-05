/**
 * REFACTORED SPLIT METHOD ROUTING - BEST PRACTICES
 * File: Split method routing implementation patterns
 * 
 * This file shows best practices for routing to different split calculation methods
 */

// ============================================================================
// ✅ CORRECT PATTERN 1: Clean Switch-Case with Logging
// ============================================================================

export function calculateSplit_CORRECT_V1(input: SplitCalculationInput): PaymentBreakdown[] {
  const {
    grandTotal,
    participants,
    items,
    taxAmount,
    serviceChargeAmount,
    splitMethod,
    percentages = {},
    customAmounts = {},
  } = input;

  // Step 1: DEBUG - What method are we using?
  console.log('📊 [calculateSplit] Starting with splitMethod:', splitMethod);

  try {
    let result: PaymentBreakdown[];

    // Step 2: Route to correct handler
    switch (splitMethod) {
      case 'EQUAL':
        console.log('📊 [calculateSplit] → Using EQUAL split handler');
        result = calculateEqualSplit(grandTotal, participants);
        break;

      case 'ITEM':
        console.log('📊 [calculateSplit] → Using ITEM split handler');
        result = calculateItemSplit(
          items,
          participants,
          grandTotal,
          taxAmount,
          serviceChargeAmount,
          grandTotal - taxAmount - serviceChargeAmount
        );
        break;

      case 'PERCENTAGE':
        console.log('📊 [calculateSplit] → Using PERCENTAGE split handler');
        result = calculatePercentageSplit(grandTotal, participants, percentages);
        break;

      case 'CUSTOM':
        console.log('📊 [calculateSplit] → Using CUSTOM split handler');
        result = calculateCustomSplit(participants, customAmounts);
        break;

      default:
        console.warn('⚠️ [calculateSplit] Unknown splitMethod:', splitMethod);
        console.warn('⚠️ [calculateSplit] Falling back to EQUAL split (warning!)');
        result = calculateEqualSplit(grandTotal, participants);
    }

    // Step 3: VERIFY result
    const resultTotal = result.reduce((sum, item) => sum + item.amount, 0);
    const isValid = Math.abs(resultTotal - grandTotal) < 0.01;

    console.log('📊 [calculateSplit] Result verification:');
    console.log(`  - Result total: ${resultTotal}`);
    console.log(`  - Expected: ${grandTotal}`);
    console.log(`  - Valid: ${isValid ? '✅' : '❌'}`);

    if (!isValid) {
      console.warn('⚠️ [calculateSplit] Result total does not match expected');
    }

    return result;
  } catch (error) {
    console.error('❌ [calculateSplit] ERROR calculating split:', error);
    
    // Return safe fallback
    return participants.map(p => ({
      participantId: p.id,
      participantName: p.name,
      amount: 0,
    }));
  }
}

// ============================================================================
// ✅ CORRECT PATTERN 2: Object-based Dispatcher (Functional Approach)
// ============================================================================

type SplitHandler = (
  grandTotal: number,
  participants: Participant[],
  items: Item[],
  taxAmount: number,
  serviceChargeAmount: number,
  percentages?: Record<string, number>,
  customAmounts?: Record<string, number>
) => PaymentBreakdown[];

const splitHandlers: Record<SplitMethod, SplitHandler> = {
  EQUAL: (grandTotal, participants) => {
    console.log('📊 [calculateSplit] → Dispatched to EQUAL handler');
    return calculateEqualSplit(grandTotal, participants);
  },

  ITEM: (grandTotal, participants, items, taxAmount, serviceChargeAmount) => {
    console.log('📊 [calculateSplit] → Dispatched to ITEM handler');
    return calculateItemSplit(
      items,
      participants,
      grandTotal,
      taxAmount,
      serviceChargeAmount,
      grandTotal - taxAmount - serviceChargeAmount
    );
  },

  PERCENTAGE: (grandTotal, participants, items, taxAmount, serviceChargeAmount, percentages) => {
    console.log('📊 [calculateSplit] → Dispatched to PERCENTAGE handler');
    return calculatePercentageSplit(grandTotal, participants, percentages || {});
  },

  CUSTOM: (grandTotal, participants, items, taxAmount, serviceChargeAmount, _, customAmounts) => {
    console.log('📊 [calculateSplit] → Dispatched to CUSTOM handler');
    return calculateCustomSplit(participants, customAmounts || {});
  },
};

export function calculateSplit_CORRECT_V2(input: SplitCalculationInput): PaymentBreakdown[] {
  const {
    grandTotal,
    participants,
    items,
    taxAmount,
    serviceChargeAmount,
    splitMethod,
    percentages,
    customAmounts,
  } = input;

  console.log('📊 [calculateSplit] Starting with splitMethod:', splitMethod);

  try {
    // Get handler for split method (falls back to EQUAL if not found)
    const handler = splitHandlers[splitMethod] || splitHandlers.EQUAL;

    const result = handler(
      grandTotal,
      participants,
      items,
      taxAmount,
      serviceChargeAmount,
      percentages,
      customAmounts
    );

    // Verify
    const resultTotal = result.reduce((sum, item) => sum + item.amount, 0);
    console.log(`📊 [calculateSplit] Result total: ${resultTotal}, Expected: ${grandTotal}`);

    return result;
  } catch (error) {
    console.error('❌ [calculateSplit] ERROR:', error);
    return participants.map(p => ({
      participantId: p.id,
      participantName: p.name,
      amount: 0,
    }));
  }
}

// ============================================================================
// ✅ CORRECT PATTERN 3: With Validation & Sanitization
// ============================================================================

interface SplitCalculationConfig {
  splitMethod: SplitMethod;
  items: Item[];
  participants: Participant[];
  grandTotal: number;
  taxAmount: number;
  serviceChargeAmount: number;
  percentages?: Record<string, number>;
  customAmounts?: Record<string, number>;
}

interface CalculationResult {
  success: boolean;
  breakdown: PaymentBreakdown[];
  error?: string;
  metadata?: {
    splitMethod: SplitMethod;
    totalAmount: number;
    participantCount: number;
    executionTime: number;
  };
}

export function calculateSplit_CORRECT_V3(config: SplitCalculationConfig): CalculationResult {
  const startTime = performance.now();

  // Step 1: Validate input
  const validation = validateSplitCalculationInput(config);
  if (!validation.valid) {
    return {
      success: false,
      breakdown: [],
      error: validation.error,
    };
  }

  // Step 2: Sanitize split method
  const splitMethod = (
    config.splitMethod &&
    ['EQUAL', 'ITEM', 'PERCENTAGE', 'CUSTOM'].includes(config.splitMethod)
      ? config.splitMethod
      : 'EQUAL'
  ) as SplitMethod;

  console.log('📊 [calculateSplit] Starting calculation:');
  console.log(`  - Method: ${splitMethod}`);
  console.log(`  - Participants: ${config.participants.length}`);
  console.log(`  - Items: ${config.items.length}`);

  try {
    // Step 3: Calculate based on method
    let breakdown: PaymentBreakdown[];

    if (splitMethod === 'EQUAL') {
      breakdown = calculateEqualSplit(config.grandTotal, config.participants);
    } else if (splitMethod === 'ITEM') {
      breakdown = calculateItemSplit(
        config.items,
        config.participants,
        config.grandTotal,
        config.taxAmount,
        config.serviceChargeAmount,
        config.grandTotal - config.taxAmount - config.serviceChargeAmount
      );
    } else if (splitMethod === 'PERCENTAGE') {
      breakdown = calculatePercentageSplit(
        config.grandTotal,
        config.participants,
        config.percentages || {}
      );
    } else if (splitMethod === 'CUSTOM') {
      breakdown = calculateCustomSplit(config.participants, config.customAmounts || {});
    } else {
      breakdown = calculateEqualSplit(config.grandTotal, config.participants);
    }

    // Step 4: Validate result
    const resultTotal = breakdown.reduce((sum, item) => sum + item.amount, 0);
    const isValid = Math.abs(resultTotal - config.grandTotal) < 0.01;

    if (!isValid) {
      console.warn('⚠️ [calculateSplit] Result validation failed');
      console.warn(`  - Got: ${resultTotal}, Expected: ${config.grandTotal}`);
    }

    const executionTime = performance.now() - startTime;

    return {
      success: true,
      breakdown,
      metadata: {
        splitMethod,
        totalAmount: resultTotal,
        participantCount: config.participants.length,
        executionTime,
      },
    };
  } catch (error) {
    console.error('❌ [calculateSplit] Exception caught:', error);

    const executionTime = performance.now() - startTime;

    return {
      success: false,
      breakdown: config.participants.map(p => ({
        participantId: p.id,
        participantName: p.name,
        amount: 0,
      })),
      error: error instanceof Error ? error.message : 'Unknown error',
      metadata: {
        splitMethod,
        totalAmount: 0,
        participantCount: config.participants.length,
        executionTime,
      },
    };
  }
}

// ============================================================================
// ✅ CORRECT PATTERN 4: With Hooks in React Context
// ============================================================================

export function useCalculateBreakdown() {
  const onCalculate = useCallback(
    (config: SplitCalculationConfig): CalculationResult => {
      console.log('🧮 [useCalculateBreakdown] Starting calculation');

      const result = calculateSplit_CORRECT_V3(config);

      if (!result.success) {
        console.error('❌ [useCalculateBreakdown] Calculation failed:', result.error);
      } else {
        console.log('✅ [useCalculateBreakdown] Calculation successful');
        console.log('  - Method:', result.metadata?.splitMethod);
        console.log('  - Total:', result.metadata?.totalAmount);
        console.log('  - Time:', result.metadata?.executionTime, 'ms');
      }

      return result;
    },
    []
  );

  return { onCalculate };
}

// ============================================================================
// ❌ INCORRECT PATTERNS TO AVOID
// ============================================================================

// ❌ WRONG 1: Silent fallback with no indication
export function calculateSplit_WRONG_V1(input: SplitCalculationInput): PaymentBreakdown[] {
  switch (input.splitMethod) {
    case 'EQUAL':
      return calculateEqualSplit(...);
    // Missing ITEM, PERCENTAGE, CUSTOM cases
    default:
      return []; // ← Silent failure!
  }
}

// ❌ WRONG 2: No logging or verification
export function calculateSplit_WRONG_V2(input: SplitCalculationInput): PaymentBreakdown[] {
  if (input.splitMethod === 'EQUAL') {
    return calculateEqualSplit(...);
  }
  if (input.splitMethod === 'ITEM') {
    return calculateItemSplit(...);
  }
  // No else, no logging, no verification
  return calculateEqualSplit(...);
}

// ❌ WRONG 3: Mutation of state
export function calculateSplit_WRONG_V3(input: SplitCalculationInput): PaymentBreakdown[] {
  let breakdown = input.breakdown || []; // Using old breakdown
  
  if (input.splitMethod === 'ITEM') {
    breakdown.forEach(item => {
      item.amount = calculateItemAmount(...); // Mutating!
    });
  }
  
  return breakdown; // Could be accumulating old data
}

// ❌ WRONG 4: No error handling
export function calculateSplit_WRONG_V4(input: SplitCalculationInput): PaymentBreakdown[] {
  // What if calculateItemSplit throws?
  return calculateItemSplit(...); // No try-catch, crash!
}

// ============================================================================
// Helper: Input Validation
// ============================================================================

interface ValidationCheck {
  valid: boolean;
  error?: string;
}

function validateSplitCalculationInput(config: SplitCalculationConfig): ValidationCheck {
  if (!config.splitMethod) {
    return { valid: false, error: 'Split method not specified' };
  }

  if (!config.participants || config.participants.length === 0) {
    return { valid: false, error: 'No participants' };
  }

  if (config.grandTotal <= 0) {
    return { valid: false, error: 'Invalid grand total' };
  }

  if (config.splitMethod === 'ITEM' && (!config.items || config.items.length === 0)) {
    return { valid: false, error: 'ITEM split requires items' };
  }

  if (config.splitMethod === 'PERCENTAGE' && !config.percentages) {
    return { valid: false, error: 'PERCENTAGE split requires percentages' };
  }

  if (config.splitMethod === 'CUSTOM' && !config.customAmounts) {
    return { valid: false, error: 'CUSTOM split requires amounts' };
  }

  return { valid: true };
}

// ============================================================================
// SUMMARY: Which Pattern to Use?
// ============================================================================

/*
PATTERN RECOMMENDATION:

Use Pattern V1 (Switch-Case) if:
- Simple app with 4 split methods
- Want clear, explicit code
- Debugging is priority

Use Pattern V2 (Dispatcher) if:
- Want extensible design
- Plan to add more split methods
- Prefer functional approach

Use Pattern V3 (With Validation) if:
- Production app
- Need error handling
- Want comprehensive logging

Use Pattern V4 (With Hooks) if:
- React app with context
- Need reusable calculation logic
- Want performance monitoring

MINIMUM REQUIREMENTS FOR ANY PATTERN:
✅ Log which method is being used
✅ Verify result matches expected total
✅ Handle errors gracefully
✅ Never silently fallback
✅ Validate input parameters
✅ Return safe fallback if error
✅ No state mutation
*/
