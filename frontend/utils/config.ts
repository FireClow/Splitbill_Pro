import { Platform } from 'react-native';

/**
 * API Configuration
 * - Development: Uses local machine IP for network access via Expo Go
 * - Production: Uses deployed API endpoint
 */

// Development IP - change this if your laptop IP changes
const DEV_API_IP = '192.168.1.3';
const DEV_API_PORT = 8000;

// Production API endpoint
const PROD_API_URL = 'https://api.splitbill.com';

// Environment detection
const isDevelopment = __DEV__;

// Determine the correct host based on platform
const getDevApiHost = () => {
  if (Platform.OS === 'web') {
    // For web browser, always use localhost
    return 'localhost';
  }
  // For mobile (Expo Go), use network IP
  return DEV_API_IP;
};

export const API_CONFIG = {
  // Base URL for API calls
  baseURL: isDevelopment 
    ? `http://${getDevApiHost()}:${DEV_API_PORT}`
    : PROD_API_URL,

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
