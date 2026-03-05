/**
 * Split Bill Flow Context
 * File: frontend/contexts/SplitBillContext.tsx
 * 
 * Manages the state for the create bill flow
 * Provides context for multi-step form with real-time calculations
 */

import { createContext, useContext, useReducer, ReactNode, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  CreateBillFormState,
  Item,
  Participant,
  SplitMethod,
  PaymentBreakdown,
} from '../types/billing';
import {
  calculateSubtotal,
  calculateTaxAmount,
  calculateServiceChargeAmount,
  calculateGrandTotal,
  calculateSplit,
} from '../utils/splitCalculations';

type Action =
  | { type: 'INIT_FORM' }
  | { type: 'SET_TITLE'; payload: string }
  | { type: 'SET_CURRENCY'; payload: string }
  | { type: 'SET_INPUT_METHOD'; payload: 'MANUAL' | 'PHOTO' }
  | { type: 'ADD_ITEM'; payload: Item }
  | { type: 'UPDATE_ITEM'; payload: Item }
  | { type: 'REMOVE_ITEM'; payload: string }
  | { type: 'CLEAR_ITEMS' }
  | { type: 'SET_TAX'; payload: { value: number; type: 'percentage' | 'fixed' } }
  | { type: 'SET_SERVICE_CHARGE'; payload: { value: number; type: 'percentage' | 'fixed' } }
  | { type: 'ADD_PARTICIPANT'; payload: Participant }
  | { type: 'UPDATE_PARTICIPANT'; payload: Participant }
  | { type: 'REMOVE_PARTICIPANT'; payload: string }
  | { type: 'SET_SPLIT_METHOD'; payload: SplitMethod }
  | { type: 'SET_PERCENTAGES'; payload: Record<string, number> }
  | { type: 'SET_CUSTOM_AMOUNTS'; payload: Record<string, number> }
  | { type: 'UPDATE_BREAKDOWN'; payload: PaymentBreakdown[] }
  | { type: 'RESET_FORM' };

interface SplitBillContextType {
  form: CreateBillFormState;
  dispatch: React.Dispatch<Action>;
  setTitle: (title: string) => void;
  setCurrency: (currency: string) => void;
  setInputMethod: (method: 'MANUAL' | 'PHOTO') => void;
  addItem: (item: Omit<Item, 'id'>) => void;
  updateItem: (itemId: string, item: Omit<Item, 'id'>) => void;
  removeItem: (itemId: string) => void;
  setTax: (value: number, type: 'percentage' | 'fixed') => void;
  setServiceCharge: (value: number, type: 'percentage' | 'fixed') => void;
  addParticipant: (name: string) => void;
  updateParticipant: (participantId: string, name: string) => void;
  removeParticipant: (participantId: string) => void;
  setSplitMethod: (method: SplitMethod) => void;
  setPercentages: (percentages: Record<string, number>) => void;
  setCustomAmounts: (amounts: Record<string, number>) => void;
  updateItemAssignment: (itemId: string, participantIds: string[]) => void;
  resetForm: () => void;
}

const SplitBillContext = createContext<SplitBillContextType | undefined>(undefined);

const initialFormState: CreateBillFormState = {
  title: '',
  currency: 'IDR',
  inputMethod: 'MANUAL',
  items: [],
  taxValue: 0,
  taxType: 'percentage',
  serviceChargeValue: 0,
  serviceChargeType: 'percentage',
  participants: [],
  splitMethod: 'EQUAL',
  subtotal: 0,
  taxAmount: 0,
  serviceChargeAmount: 0,
  grandTotal: 0,
  breakdown: [],
};

function calculateAndUpdateForm(prevForm: CreateBillFormState): CreateBillFormState {
  // DEBUG: Log current state
  console.log('🔄 [calculateAndUpdateForm] Current splitMethod:', prevForm.splitMethod);
  console.log('🔄 [calculateAndUpdateForm] Items count:', prevForm.items.length);
  console.log('🔄 [calculateAndUpdateForm] Participants count:', prevForm.participants.length);

  const subtotal = calculateSubtotal(prevForm.items);
  const taxAmount = calculateTaxAmount(subtotal, prevForm.taxValue, prevForm.taxType);
  const serviceChargeAmount = calculateServiceChargeAmount(
    subtotal,
    prevForm.serviceChargeValue,
    prevForm.serviceChargeType
  );
  const grandTotal = calculateGrandTotal(subtotal, taxAmount, serviceChargeAmount);

  // DEBUG: Log calculations
  console.log('🔄 [calculateAndUpdateForm] Subtotal:', subtotal);
  console.log('🔄 [calculateAndUpdateForm] Tax:', taxAmount);
  console.log('🔄 [calculateAndUpdateForm] Service:', serviceChargeAmount);
  console.log('🔄 [calculateAndUpdateForm] GrandTotal:', grandTotal);

  // Calculate breakdown based on split method
  const breakdown = calculateSplit({
    grandTotal,
    participants: prevForm.participants,
    items: prevForm.items,
    taxAmount,
    serviceChargeAmount,
    splitMethod: prevForm.splitMethod,
    // Pass percentages/customAmounts if available (from context state if needed)
    percentages: prevForm.percentages || {},
    customAmounts: prevForm.customAmounts || {},
  });

  // DEBUG: Log result
  console.log('🔄 [calculateAndUpdateForm] Final breakdown:', breakdown);
  console.log('🔄 [calculateAndUpdateForm] Breakdown total:', breakdown.reduce((sum, b) => sum + b.amount, 0));

  return {
    ...prevForm,
    subtotal,
    taxAmount,
    serviceChargeAmount,
    grandTotal,
    breakdown,
  };
}

function formReducer(state: CreateBillFormState, action: Action): CreateBillFormState {
  let newState = state;

  switch (action.type) {
    case 'INIT_FORM':
      return calculateAndUpdateForm(initialFormState);

    case 'SET_TITLE':
      newState = { ...state, title: action.payload };
      break;

    case 'SET_CURRENCY':
      newState = { ...state, currency: action.payload };
      break;

    case 'SET_INPUT_METHOD':
      newState = { ...state, inputMethod: action.payload };
      break;

    case 'ADD_ITEM':
      newState = { ...state, items: [...state.items, action.payload] };
      break;

    case 'UPDATE_ITEM':
      newState = {
        ...state,
        items: state.items.map(item =>
          item.id === action.payload.id ? action.payload : item
        ),
      };
      break;

    case 'REMOVE_ITEM':
      newState = {
        ...state,
        items: state.items.filter(item => item.id !== action.payload),
      };
      break;

    case 'CLEAR_ITEMS':
      newState = { ...state, items: [] };
      break;

    case 'SET_TAX':
      newState = {
        ...state,
        taxValue: action.payload.value,
        taxType: action.payload.type,
      };
      break;

    case 'SET_SERVICE_CHARGE':
      newState = {
        ...state,
        serviceChargeValue: action.payload.value,
        serviceChargeType: action.payload.type,
      };
      break;

    case 'ADD_PARTICIPANT':
      newState = { ...state, participants: [...state.participants, action.payload] };
      break;

    case 'UPDATE_PARTICIPANT':
      newState = {
        ...state,
        participants: state.participants.map(p =>
          p.id === action.payload.id ? action.payload : p
        ),
      };
      break;

    case 'REMOVE_PARTICIPANT':
      newState = {
        ...state,
        participants: state.participants.filter(p => p.id !== action.payload),
        // Clean up assigned_to in items
        items: state.items.map(item => ({
          ...item,
          assignedTo: (item.assignedTo || []).filter(id => id !== action.payload),
        })),
      };
      break;

    case 'SET_SPLIT_METHOD':
      newState = { ...state, splitMethod: action.payload };
      break;

    case 'SET_PERCENTAGES':
      newState = { ...state, percentages: action.payload };
      break;

    case 'SET_CUSTOM_AMOUNTS':
      newState = { ...state, customAmounts: action.payload };
      break;

    case 'UPDATE_BREAKDOWN':
      newState = { ...state, breakdown: action.payload };
      break;

    case 'RESET_FORM':
      return calculateAndUpdateForm(initialFormState);

    default:
      return state;
  }

  // Recalculate after any state change
  return calculateAndUpdateForm(newState);
}

export function SplitBillProvider({ children }: { children: ReactNode }) {
  const [form, dispatch] = useReducer(formReducer, initialFormState, state =>
    calculateAndUpdateForm(state)
  );

  const setTitle = useCallback(
    (title: string) => dispatch({ type: 'SET_TITLE', payload: title }),
    []
  );

  const setCurrency = useCallback(
    (currency: string) => dispatch({ type: 'SET_CURRENCY', payload: currency }),
    []
  );

  const setInputMethod = useCallback(
    (method: 'MANUAL' | 'PHOTO') =>
      dispatch({ type: 'SET_INPUT_METHOD', payload: method }),
    []
  );

  const addItem = useCallback(
    (item: Omit<Item, 'id'>) => {
      const newItem: Item = { ...item, id: uuidv4() };
      dispatch({ type: 'ADD_ITEM', payload: newItem });
    },
    []
  );

  const updateItem = useCallback(
    (itemId: string, item: Omit<Item, 'id'>) => {
      dispatch({ type: 'UPDATE_ITEM', payload: { ...item, id: itemId } });
    },
    []
  );

  const removeItem = useCallback(
    (itemId: string) => dispatch({ type: 'REMOVE_ITEM', payload: itemId }),
    []
  );

  const setTax = useCallback(
    (value: number, type: 'percentage' | 'fixed') => {
      dispatch({ type: 'SET_TAX', payload: { value, type } });
    },
    []
  );

  const setServiceCharge = useCallback(
    (value: number, type: 'percentage' | 'fixed') => {
      dispatch({ type: 'SET_SERVICE_CHARGE', payload: { value, type } });
    },
    []
  );

  const addParticipant = useCallback(
    (name: string) => {
      const newParticipant: Participant = { id: uuidv4(), name };
      dispatch({ type: 'ADD_PARTICIPANT', payload: newParticipant });
    },
    []
  );

  const updateParticipant = useCallback(
    (participantId: string, name: string) => {
      dispatch({
        type: 'UPDATE_PARTICIPANT',
        payload: { id: participantId, name },
      });
    },
    []
  );

  const removeParticipant = useCallback(
    (participantId: string) =>
      dispatch({ type: 'REMOVE_PARTICIPANT', payload: participantId }),
    []
  );

  const setSplitMethod = useCallback(
    (method: SplitMethod) => dispatch({ type: 'SET_SPLIT_METHOD', payload: method }),
    []
  );

  const setPercentages = useCallback(
    (percentages: Record<string, number>) => 
      dispatch({ type: 'SET_PERCENTAGES', payload: percentages }),
    []
  );

  const setCustomAmounts = useCallback(
    (amounts: Record<string, number>) => 
      dispatch({ type: 'SET_CUSTOM_AMOUNTS', payload: amounts }),
    []
  );

  const updateItemAssignment = useCallback(
    (itemId: string, participantIds: string[]) => {
      const item = form.items.find(i => i.id === itemId);
      if (item) {
        updateItem(itemId, { ...item, assignedTo: participantIds });
      }
    },
    [form.items, updateItem]
  );

  const resetForm = useCallback(
    () => dispatch({ type: 'RESET_FORM' }),
    []
  );

  const value: SplitBillContextType = {
    form,
    dispatch,
    setTitle,
    setCurrency,
    setInputMethod,
    addItem,
    updateItem,
    removeItem,
    setTax,
    setServiceCharge,
    addParticipant,
    updateParticipant,
    removeParticipant,
    setSplitMethod,
    setPercentages,
    setCustomAmounts,
    updateItemAssignment,
    resetForm,
  };

  return (
    <SplitBillContext.Provider value={value}>
      {children}
    </SplitBillContext.Provider>
  );
}

export function useSplitBill(): SplitBillContextType {
  const context = useContext(SplitBillContext);
  if (!context) {
    throw new Error('useSplitBill must be used within SplitBillProvider');
  }
  return context;
}
