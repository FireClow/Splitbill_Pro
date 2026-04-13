import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * API Configuration
 * - Development: Uses local machine IP for network access via Expo Go
 * - Production: Uses deployed API endpoint
 */

const DEV_API_PORT = 8000;
const DEFAULT_LOCAL_WEB_HOST = '127.0.0.1';
const DEFAULT_LOCAL_NATIVE_HOST = '10.0.2.2';
const EXPO_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL?.trim();

// Environment detection
const isDevelopment = __DEV__;

const normalizeBaseUrl = (url: string): string => {
  return url.replace(/\/$/, '');
};

const getExpoLanHost = (): string | null => {
  const hostUri =
    (Constants.expoConfig as any)?.hostUri ||
    (Constants as any)?.manifest2?.extra?.expoClient?.hostUri ||
    (Constants as any)?.manifest?.debuggerHost;

  if (!hostUri || typeof hostUri !== 'string') {
    return null;
  }

  return hostUri.split(':')[0] || null;
};

// Determine the correct host based on platform
const getDevApiHost = () => {
  if (Platform.OS === 'web') {
    return DEFAULT_LOCAL_WEB_HOST;
  }

  const expoLanHost = getExpoLanHost();
  if (expoLanHost) {
    return expoLanHost;
  }

  // Android emulator can access host machine via 10.0.2.2.
  return DEFAULT_LOCAL_NATIVE_HOST;
};

const rewriteLocalhostForNative = (url: string): string => {
  if (Platform.OS === 'web') {
    return url;
  }

  const expoLanHost = getExpoLanHost();
  if (!expoLanHost) {
    return url;
  }

  return url.replace(/(https?:\/\/)(localhost|127\.0\.0\.1)/i, `$1${expoLanHost}`);
};

const getFallbackBaseUrl = (): string => {
  return `http://${getDevApiHost()}:${DEV_API_PORT}`;
};

const resolveBaseUrl = (): string => {
  if (EXPO_BACKEND_URL) {
    const normalized = normalizeBaseUrl(EXPO_BACKEND_URL);
    const rewritten = rewriteLocalhostForNative(normalized);

    // Block local loopback endpoints in production builds.
    if (!isDevelopment && /localhost|127\.0\.0\.1|10\.0\.2\.2/i.test(rewritten)) {
      return '';
    }

    return rewritten;
  }

  // Development fallback keeps local iteration fast.
  if (isDevelopment) {
    return getFallbackBaseUrl();
  }

  // In production builds, force explicit backend URL configuration.
  return '';
};

const resolvedBaseUrl = resolveBaseUrl();

export const API_CONFIG = {
  // Base URL for API calls
  baseURL: resolvedBaseUrl,

  // API endpoints
  endpoints: {
    health: '/api/health',
    auth: {
      login: '/api/auth/login',
      logout: '/api/auth/logout',
      verify: '/api/auth/verify',
    },
    bills: {
      list: '/api/bills',
      create: '/api/bills',
      get: (id: string) => `/api/bills/${id}`,
      update: (id: string) => `/api/bills/${id}`,
      delete: (id: string) => `/api/bills/${id}`,
    },
    ocr: {
      scanReceipt: '/api/ocr/scan-receipt',
      rescanCropped: '/api/ocr/rescan-cropped',
      confirmReceipt: '/api/ocr/confirm-receipt',
      suggestCrop: '/api/ocr/suggest-crop',
    },
    dashboard: '/api/dashboard/stats',
  },

  // Timeouts
  timeouts: {
    default: 30000,      // 30 seconds
    upload: 60000,       // 60 seconds (for large files)
  },

  // Debug mode
  debug: isDevelopment,

  // Runtime availability guard for API-dependent features.
  isBackendConfigured: resolvedBaseUrl.length > 0,
};

/**
 * Helper to build full URL
 * @param endpoint - API endpoint (e.g., '/api/bills')
 * @returns Full URL
 */
export const getApiUrl = (endpoint: string): string => {
  return `${API_CONFIG.baseURL}${endpoint}`;
};

/**
 * Helper to get OCR endpoint
 * @param type - 'scan', 'rescan', 'confirm', or 'suggest'
 * @returns Full URL
 */
export const getOcrUrl = (type: 'scan' | 'rescan' | 'confirm' | 'suggest'): string => {
  const endpoints = {
    scan: API_CONFIG.endpoints.ocr.scanReceipt,
    rescan: API_CONFIG.endpoints.ocr.rescanCropped,
    confirm: API_CONFIG.endpoints.ocr.confirmReceipt,
    suggest: API_CONFIG.endpoints.ocr.suggestCrop,
  };
  return getApiUrl(endpoints[type]);
};

export default API_CONFIG;
