/**
 * ============================================================================
 * SPLIT BILL 7-STEP FLOW - COMPLETE IMPLEMENTATION GUIDE
 * ============================================================================
 * 
 * This document describes the complete architecture and implementation of
 * the 7-step Split Bill creation flow with clean separation of concerns.
 * 
 * FLOW OVERVIEW:
 * Step 1: Input Method Selection (Manual/OCR) → create-bill-step1.tsx
 * Step 2: Basic Info (Title, Currency) → create-bill-step2.tsx
 * Step 3: Bill Details (Items, Tax, Service Charge) → create-bill-step3.tsx
 * Step 4: Participants Management → create-bill-step4.tsx
 * Step 5: Split Method Selection (Equal/Item/Percentage/Custom) → create-bill-step5.tsx
 * Step 6: Review & Create → create-bill-step6.tsx
 * 
 * Orchestrator: create-bill-flow.tsx
 * State Management: SplitBillContext.tsx
 * 
 * ============================================================================
 * ARCHITECTURE PATTERN: CLEAN ARCHITECTURE WITH SEPARATION OF CONCERNS
 * ============================================================================
 * 
 * Layer 1: Types (frontend/types/billing.ts)
 *   - Defines all TypeScript interfaces for type safety
 *   - CreateBillFormState: Main form state interface
 *   - Bill, Item, Participant, PaymentBreakdown: Domain models
 *   - SplitMethod: Union type for split strategies
 * 
 * Layer 2: Business Logic (frontend/utils/splitCalculations.ts)
 *   - Pure functions with no side effects
 *   - calculateSubtotal(): Sum prices × quantities
 *   - calculateTaxAmount(): Calculate tax based on type
 *   - calculateGrandTotal(): Sum of all components
 *   - calculateSplit(): Route to specific split method calculators
 *   - calculateEqualSplit(): Equal distribution
 *   - calculateItemSplit(): Item-based distribution
 *   - calculatePercentageSplit(): Percentage-based distribution
 *   - calculateCustomSplit(): Custom amounts
 * 
 * Layer 3: Validation (frontend/utils/splitBillValidation.ts)
 *   - validateTitle(): Check name requirements (1-200 chars)
 *   - validateCurrency(): Whitelist of supported currencies
 *   - validateItems(): Check price > 0, quantity ≥ 1
 *   - validateTax(): Prevent negative, cap at 100%
 *   - validateParticipants(): Require 2+, prevent duplicates
 *   - validatePercentageSplit(): Total must = 100% (with tolerance)
 *   - validateCustomSplit(): Total must = grandTotal (with tolerance)
 *   - validateCreateBillForm(): Comprehensive validation
 * 
 * Layer 4: State Management (frontend/contexts/SplitBillContext.tsx)
 *   - useReducer pattern for predictable state updates
 *   - Real-time calculation triggering on any state change
 *   - Callback functions for component integration
 *   - Automatic breakdown calculation after state updates
 * 
 * Layer 5: UI Components (6 step screens + orchestrator)
 *   - Each step component is isolated and focused
 *   - Uses context hooks for state access
 *   - Navigation buttons handle step progression
 *   - Real-time validation feedback
 * 
 * ============================================================================
 * STATE MANAGEMENT FLOW
 * ============================================================================
 * 
 * SplitBillContext manages:
 *   - Form data (title, currency, items, tax, service charge)
 *   - Participant list
 *   - Split method selection
 *   - Breakdown (calculated automatically)
 *   - Totals (subtotal, tax amount, service charge amount, grand total)
 * 
 * State Update Flow:
 *   User Input → Dispatch Action → Reducer → Calculate Totals → Re-render
 * 
 * Example (Adding Item):
 *   1. User fills item form in Step 3
 *   2. Component calls addItem(itemData)
 *   3. Dispatch { type: 'ADD_ITEM', payload: item }
 *   4. Reducer updates items array
 *   5. calculateAndUpdateForm() triggered automatically
 *   6. Subtotal, tax, service charge, grand total calculated
 *   7. Breakdown recalculated based on split method
 *   8. Component re-renders with new values
 * 
 * ============================================================================
 * CALCULATION FLOW DETAILS
 * ============================================================================
 * 
 * EQUAL SPLIT CALCULATION:
 *   Input: participants array, grandTotal
 *   Output: breakdown array with equal amounts
 *   Formula: amount = grandTotal / numberOfParticipants
 *   Tax/Service Distribution: Distributed equally among participants
 * 
 * ITEM SPLIT CALCULATION:
 *   Input: items array with assignedTo, participants, grandTotal
 *   Output: breakdown array with item-based amounts
 *   Formula: 
 *     - Base cost = sum of item prices for participant
 *     - Item share of tax = (base cost / subtotal) * tax
 *     - Item share of service = (base cost / subtotal) * service charge
 *     - Total = base cost + tax share + service share
 *   
 *   Example:
 *     Items: Burger ($10, assigned to John), Salad ($5, assigned to Jane)
 *     Tax: 10% = $1.50
 *     John's share = $10 + ($10/$15 * $1.50) = $11
 *     Jane's share = $5 + ($5/$15 * $1.50) = $5.50
 * 
 * PERCENTAGE SPLIT CALCULATION:
 *   Input: participants with percentage assignments, grandTotal
 *   Output: breakdown array with calculated amounts
 *   Formula: amount = (percentage / 100) * grandTotal
 *   Validation: All percentages must sum to 100% (with 0.01 tolerance)
 * 
 * CUSTOM SPLIT CALCULATION:
 *   Input: participants with custom amounts
 *   Output: breakdown array with assigned amounts
 *   Validation: All amounts must sum to grandTotal (with 0.01 tolerance)
 * 
 * ============================================================================
 * VALIDATION STRATEGY
 * ============================================================================
 * 
 * Double Validation:
 *   1. Input Validation: Validate as user types/enters data
 *   2. Form Validation: Comprehensive check before creation
 * 
 * Floating Point Tolerance:
 *   - TOLERANCE = 0.01 (1 cent)
 *   - Used for percentage and custom split validation
 *   - Prevents issues from floating point arithmetic
 * 
 * Validation Order (Step 6):
 *   1. Title: Not empty, 1-200 chars
 *   2. Currency: In whitelist
 *   3. Items: At least 1, all valid
 *   4. Tax: Valid amount/percentage
 *   5. Service Charge: Valid amount/percentage
 *   6. Participants: At least 2, no duplicates
 *   7. Split Specifics Based on Method:
 *      - EQUAL: No additional validation
 *      - ITEM: At least one item assigned to each participant (optional)
 *      - PERCENTAGE: Total = 100%
 *      - CUSTOM: Total = grand total
 *   8. Breakdown: Sum = grand total
 * 
 * ============================================================================
 * FILE STRUCTURE
 * ============================================================================
 * 
 * frontend/
 * ├── types/
 * │   └── billing.ts (Type definitions)
 * ├── utils/
 * │   ├── splitCalculations.ts (Business logic)
 * │   └── splitBillValidation.ts (Validation)
 * ├── contexts/
 * │   └── SplitBillContext.tsx (State management)
 * └── app/
 *     ├── create-bill-flow.tsx (Orchestrator)
 *     └── (tabs)/
 *         ├── create-bill-step1.tsx (Input method)
 *         ├── create-bill-step2.tsx (Basic info)
 *         ├── create-bill-step3.tsx (Bill details)
 *         ├── create-bill-step4.tsx (Participants)
 *         ├── create-bill-step5.tsx (Split method)
 *         └── create-bill-step6.tsx (Review & create)
 * 
 * ============================================================================
 * INTEGRATION POINTS
 * ============================================================================
 * 
 * 1. Navigation Between Steps:
 *    - Each step receives onNext() and onPrevious() callbacks
 *    - Managed by create-bill-flow.tsx orchestrator
 *    - State persists as you navigate
 * 
 * 2. API Integration (Step 6):
 *    - POST /api/bills with form data
 *    - Expected response: Bill created successfully
 *    - Error handling: Display alert to user
 * 
 * 3. Provider Integration:
 *    - Wrap app with <SplitBillProvider> at top level
 *    - All step components have access to context
 *    - State persists across navigation
 * 
 * ============================================================================
 * USAGE EXAMPLE
 * ============================================================================
 * 
 * In your main app, import and use the flow:
 * 
 *   import CreateBillFlow from './app/create-bill-flow';
 * 
 *   export default function App() {
 *     return <CreateBillFlow />;
 *   }
 * 
 * The flow handles:
 *   ✓ All 6 steps of bill creation
 *   ✓ State management across steps
 *   ✓ Real-time calculations
 *   ✓ Validation at each step
 *   ✓ API integration
 *   ✓ Navigation and progression
 * 
 * ============================================================================
 * STEP-BY-STEP IMPLEMENTATION
 * ============================================================================
 * 
 * STEP 1 - INPUT METHOD SELECTION (Create-bill-step1.tsx)
 *   User Action: Select \"Manual\" or \"Photo (OCR)\"
 *   Form Update: Sets form.inputMethod
 *   Validation: None (optional choice)
 *   Navigation: Always proceeds to Step 2 after selection
 * 
 *   Key Components:
 *     - Option cards with icons and descriptions
 *     - Selection persists in context
 *     - Can change selection before Step 2
 * 
 * STEP 2 - BASIC INFO (Create-bill-step2.tsx)
 *   User Action: Enter bill title and select currency
 *   Form Update: Sets form.title and form.currency
 *   Validation:
 *     - Title: 1-200 chars, not empty (step-level)
 *     - Currency: In whitelist (step-level)
 *   Navigation: Proceeds to Step 3 after validation
 * 
 *   Key Components:
 *     - TextInput for title with char counter
 *     - Currency dropdown with picker
 *     - Real-time validation errors
 * 
 * STEP 3 - BILL DETAILS (Create-bill-step3.tsx)
 *   User Action: Add items, enter tax and service charge
 *   Form Update:
 *     - Adds items to form.items array
 *     - Calculates subtotal
 *     - Sets tax and service charge values
 *     - Auto-calculates totals
 *   Validation:
 *     - Items: name not empty, price > 0, quantity ≥ 1 (on add)
 *     - Tax: Not negative, max 100% (on update)
 *     - Service: Not negative, max 100% (on update)
 *     - At least 1 item required (step-level)
 *   Navigation: Proceeds to Step 4 after check
 * 
 *   Key Components:
 *     - Item list with add button (modal)
 *     - Real-time subtotal calculation
 *     - Tax/Service charge inputs with type toggle
 *     - Grand total display
 *     - Live calculation feedback
 * 
 * STEP 4 - PARTICIPANTS (Create-bill-step4.tsx)
 *   User Action: Add participant names
 *   Form Update: Adds to form.participants array
 *   Validation:
 *     - Name: Not empty, prevents duplicates (on add)
 *     - At least 2 participants (step-level)
 *   Navigation: Proceeds to Step 5 after validation
 * 
 *   Key Components:
 *     - Participant list with badges
 *     - Add participant button/modal
 *     - Participant count display
 *     - Remove buttons per participant
 * 
 * STEP 5 - SPLIT METHOD (Create-bill-step5.tsx)
 *   User Action: Select split method and confirm parameters
 *   Form Update:
 *     - Sets form.splitMethod
 *     - Recalculates breakdown automatically
 *   Methods:
 *     - EQUAL: No additional input
 *     - ITEM: Shows item assignment UI (if available)
 *     - PERCENTAGE: Input percentages for each participant
 *     - CUSTOM: Input custom amounts for each participant
 *   Validation:
 *     - PERCENTAGE: Total = 100% (±0.01)
 *     - CUSTOM: Total = grandTotal (±0.01)
 *   Navigation: Proceeds to Step 6 after validation
 * 
 *   Key Components:
 *     - Method selection cards with icons
 *     - Expandable method-specific UI
 *     - Real-time sum validation
 *     - Error messages for invalid splits
 * 
 * STEP 6 - REVIEW & CREATE (Create-bill-step6.tsx)
 *   User Action: Review all details and create bill
 *   Displays:
 *     - Bill title and currency
 *     - All items with costs
 *     - Subtotal, tax, service, grand total
 *     - Full breakdown per participant
 *     - Verification that breakdown = grand total
 *   Validation:
 *     - Comprehensive form validation
 *     - Breakdown verification
 *     - All business rules checked
 *   API Call:
 *     - POST /api/bills with all form data
 *     - On success: Navigate to success screen
 *     - On error: Display error alert
 * 
 *   Key Components:
 *     - Read-only display of all values
 *     - Breakdown verification indicator
 *     - Create button (calls API)
 *     - Loading state during creation
 * 
 * ============================================================================
 * REAL-TIME CALCULATIONS WORKFLOW
 * ============================================================================
 * 
 * When User Changes Any Value:
 *   1. Component triggers context action (addItem, setTax, etc.)
 *   2. Reducer updates state
 *   3. calculateAndUpdateForm() runs automatically
 *   4. Recalculates all totals:
 *      - Subtotal = sum(price × quantity) for all items
 *      - Tax Amount = calculateTaxAmount(subtotal, taxValue, taxType)
 *      - Service Charge = calculateServiceChargeAmount(...)
 *      - Grand Total = subtotal + tax + service
 *   5. Recalculates breakdown based on split method
 *   6. Updates form state with all calculated values
 *   7. Components re-render with new values
 * 
 * Benefits:
 *   - Users see instant calculation feedback
 *   - No stale values
 *   - Consistent state across all components
 *   - Easy to add new calculation formulas
 * 
 * ============================================================================
 * TESTING RECOMMENDATIONS
 * ============================================================================
 * 
 * Unit Tests:
 *   - calculateSubtotal() with various items
 *   - calculateTaxAmount() with percentage and fixed
 *   - calculateEqualSplit() with different participant counts
 *   - All validation functions with edge cases
 * 
 * Integration Tests:
 *   - Adding item triggers calculation
 *   - Changing tax recalculates breakdown
 *   - Split method change updates breakdown
 *   - Navigation persists state
 * 
 * E2E Tests:
 *   - Complete flow through all 6 steps
 *   - Equal split with 3 participants
 *   - Item split with items assigned to different people
 *   - Percentage split summing to 100%
 *   - Custom split summing to grand total
 * 
 * ============================================================================
 * FUTURE ENHANCEMENTS
 * ============================================================================
 * 
 * 1. Receipt OCR Integration (Step 1)
 *    - Auto-populate items from receipt photo
 *    - Edit extracted data before proceeding
 * 
 * 2. Item Assignment for ITEM Method
 *    - In Step 5, allow assigning items to participants
 *    - UI with checkboxes per item
 * 
 * 3. Payment Tracking
 *    - Mark payments as sent/received
 *    - Send payment reminders
 * 
 * 4. Bill Sharing
 *    - Share bill with QR code
 *    - Shared view for participants
 * 
 * 5. Export Options\n *    - Export as PDF\n *    - Share invoice\n * \n * ============================================================================\n * API ENDPOINT REQUIREMENT\n * ============================================================================\n * \n * POST /api/bills\n * \n * Request Body:\n * {\n *   title: string (1-200 chars)\n *   currency: string (IDR, USD, SGD, etc.)\n *   items: Array<{\n *     id: string\n *     name: string\n *     price: number\n *     quantity: number\n *     assignedTo: string[] (participant IDs for ITEM split)\n *   }>\n *   taxation: {\n *     tax: { value: number, type: 'percentage' | 'fixed' }\n *     serviceCharge: { value: number, type: 'percentage' | 'fixed' }\n *   }\n *   participants: Array<{\n *     id: string\n *     name: string\n *   }>\n *   splitMethod: 'EQUAL' | 'ITEM' | 'PERCENTAGE' | 'CUSTOM'\n *   breakdown: Array<{\n *     participantId: string\n *     amount: number\n *     items?: Array<{ itemId: string, amount: number }>\n *   }>\n *   grandTotal: number\n * }\n * \n * Response (Success 200):\n * {\n *   id: string\n *   createdAt: string (ISO date)\n *   ...form data echoed back\n * }\n * \n * Response (Error):\n * {\n *   error: string\n *   message: string\n * }\n * \n * ============================================================================\n * FILE: frontend/utils/SPLIT_BILL_STEP_FLOW_IMPLEMENTATION.md\n * PURPOSE: Implementation guide for 7-step bill creation\n * CREATED: When implementing complete flow\n * MAINTAINED BY: Development team\n * ============================================================================\n */\n\n// This file serves as documentation only\n// Implementation files:\n// - Create-bill-flow.tsx (orchestrator)\n// - Create-bill-step1.tsx through create-bill-step6.tsx (step components)\n// - SplitBillContext.tsx (state management)\n// - splitCalculations.ts (business logic)\n// - splitBillValidation.ts (validation)\n// - billing.ts (types)\n