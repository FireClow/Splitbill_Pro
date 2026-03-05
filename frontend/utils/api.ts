import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { API_CONFIG } from './config';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? API_CONFIG.baseURL;

// Type definitions
interface ApiErrorResponse {
  detail?: string;
  message?: string;
}

interface AuthSessionResponse {
  session_token: string;
  user_id?: string;
}

interface ApiResponse<T = any> {
  data?: T;
  [key: string]: any;
}

export class ApiError extends Error {
  status: number;
  originalError: any;

  constructor(message: string, status: number, originalError?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.originalError = originalError;
  }
}

// Token management
const getToken = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem('session_token');
  } catch (error) {
    console.error('[API] Failed to retrieve token:', error);
    return null;
  }
};

export const setToken = async (token: string): Promise<void> => {
  try {
    await AsyncStorage.setItem('session_token', token);
  } catch (error) {
    console.error('[API] Failed to save token:', error);
    throw error;
  }
};

export const removeToken = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem('session_token');
  } catch (error) {
    console.error('[API] Failed to remove token:', error);
    throw error;
  }
};

// Core API fetch function with error handling
const apiFetch = async <T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> => {
  try {
    if (!BACKEND_URL) {
      throw new ApiError('Backend URL not configured', 0);
    }

    const token = await getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const url = `${BACKEND_URL}/api${path}`;
    console.log(`[API] ${options.method || 'GET'} ${url}`);

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });

    // Handle 401 Unauthorized
    if (response.status === 401) {
      await removeToken();
      throw new ApiError('Unauthorized - session expired', 401);
    }

    // Handle other errors
    if (!response.ok) {
      let errorData: ApiErrorResponse | unknown = {};
      try {
        errorData = await response.json();
      } catch {
        errorData = {};
      }
      const error = errorData as Partial<ApiErrorResponse>;
      throw new ApiError(
        error.detail || error.message || `Request failed: ${response.status}`,
        response.status,
        error as ApiErrorResponse
      );
    }

    return response.json() as Promise<T>;
  } catch (error) {
    if (error instanceof ApiError) {
      console.error(`[API] Error [${error.status}]:`, error.message);
      throw error;
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Error:', message);
    throw new ApiError(message, 0, error);
  }
};

// API endpoints
export const api = {
  // Auth
  exchangeSession: (sessionId: string) =>
    apiFetch<AuthSessionResponse>('/auth/session', {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId }),
    }),
  getMe: () => apiFetch('/auth/me'),
  logout: () => apiFetch('/auth/logout', { method: 'POST' }),

  // Bills
  getBills: () => apiFetch('/bills'),
  getBill: (id: string) => apiFetch(`/bills/${id}`),
  createBill: (data: Record<string, any>) =>
    apiFetch('/bills', { method: 'POST', body: JSON.stringify(data) }),
  updateBill: (id: string, data: Record<string, any>) =>
    apiFetch(`/bills/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteBill: (id: string) =>
    apiFetch(`/bills/${id}`, { method: 'DELETE' }),

  // Items
  addItem: (billId: string, data: Record<string, any>) =>
    apiFetch(`/bills/${billId}/items`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateItem: (billId: string, itemId: string, data: Record<string, any>) =>
    apiFetch(`/bills/${billId}/items/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteItem: (billId: string, itemId: string) =>
    apiFetch(`/bills/${billId}/items/${itemId}`, { method: 'DELETE' }),

  // Participants
  addParticipant: (billId: string, data: Record<string, any>) =>
    apiFetch(`/bills/${billId}/participants`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  removeParticipant: (billId: string, pId: string) =>
    apiFetch(`/bills/${billId}/participants/${pId}`, { method: 'DELETE' }),

  // Splits
  recalculateSplit: (billId: string, data: Record<string, any>) =>
    apiFetch(`/bills/${billId}/split`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Payments
  updatePayment: (billId: string, participantId: string, data: Record<string, any>) =>
    apiFetch(`/bills/${billId}/payments/${participantId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Exchange Rates
  getExchangeRate: (base: string, target: string) =>
    apiFetch(`/exchange-rates?base=${base}&target=${target}`),
  getCurrencies: () => apiFetch('/currencies'),

  // Share
  createShareLink: (billId: string) =>
    apiFetch(`/bills/${billId}/share`, {
      method: 'POST',
      body: JSON.stringify({ expires_hours: 72, public_access: true }),
    }),
  getSharedBill: (token: string) => apiFetch(`/share/${token}`),

  // Subscription
  getSubscription: () => apiFetch('/subscription'),
  upgradeSubscription: (data: Record<string, any>) =>
    apiFetch('/subscription/upgrade', { method: 'POST', body: JSON.stringify(data) }),
  getFeatures: () => apiFetch('/subscription/features'),

  // User Preferences
  getUserPreferences: () => apiFetch('/user/preferences'),
  updateUserPreferences: (data: Record<string, any>) =>
    apiFetch('/user/preferences', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Analytics
  getAnalyticsSummary: () => apiFetch('/analytics/summary'),
  getAnalyticsSpending: (month?: string) => apiFetch(`/analytics/spending${month ? `?month=${month}` : ''}`),
  getAnalyticsCurrencies: () => apiFetch('/analytics/currencies'),

  // OCR (placeholder)
  scanReceipt: () => apiFetch('/ocr/scan', { method: 'POST' }),

  // Export (placeholder)
  exportBill: (billId: string, format: string) =>
    apiFetch(`/bills/${billId}/export/${format}`, { method: 'POST' }),

  // Dashboard
  getDashboardStats: () => apiFetch('/dashboard/stats'),
};
