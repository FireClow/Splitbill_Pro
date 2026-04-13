import Constants from 'expo-constants';
import { Platform } from 'react-native';

export const PREMIUM_ENTITLEMENT_ID = 'premium';
export const FREE_SCAN_DAILY_LIMIT = 5;
export const SCAN_USAGE_STORAGE_KEY = 'monetization:scan-usage-v1';
export const BONUS_SCAN_CREDITS_STORAGE_KEY = 'monetization:bonus-scan-credits-v1';

export const getRevenueCatApiKey = (): string => {
  const extra = (Constants.expoConfig?.extra ?? {}) as {
    revenueCat?: {
      iosApiKey?: string;
      androidApiKey?: string;
    };
  };

  if (Platform.OS === 'ios') {
    return extra.revenueCat?.iosApiKey ?? '';
  }

  if (Platform.OS === 'android') {
    return extra.revenueCat?.androidApiKey ?? '';
  }

  return '';
};
