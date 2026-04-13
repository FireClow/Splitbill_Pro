import { Platform } from 'react-native';

type AdUnitType = 'banner' | 'interstitial' | 'rewarded';

const TEST_PUBLISHER_ID = '3940256099942544';

const testIds = {
  android: {
    banner: 'ca-app-pub-3940256099942544/6300978111',
    interstitial: 'ca-app-pub-3940256099942544/1033173712',
    rewarded: 'ca-app-pub-3940256099942544/5224354917',
  },
  ios: {
    banner: 'ca-app-pub-3940256099942544/2934735716',
    interstitial: 'ca-app-pub-3940256099942544/4411468910',
    rewarded: 'ca-app-pub-3940256099942544/1712485313',
  },
} as const;

const boolFromEnv = (value: string | undefined, fallback: boolean): boolean => {
  if (typeof value !== 'string') {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return fallback;
};

export const shouldUseTestIds = (): boolean => {
  return boolFromEnv(process.env.EXPO_PUBLIC_ADMOB_USE_TEST_IDS, __DEV__);
};

const getProductionAdUnitMap = (): Record<AdUnitType, string> => {
  if (Platform.OS === 'ios') {
    return {
      banner: process.env.EXPO_PUBLIC_ADMOB_IOS_BANNER_ID?.trim() ?? '',
      interstitial: process.env.EXPO_PUBLIC_ADMOB_IOS_INTERSTITIAL_ID?.trim() ?? '',
      rewarded: process.env.EXPO_PUBLIC_ADMOB_IOS_REWARDED_ID?.trim() ?? '',
    };
  }

  return {
    banner: process.env.EXPO_PUBLIC_ADMOB_ANDROID_BANNER_ID?.trim() ?? '',
    interstitial: process.env.EXPO_PUBLIC_ADMOB_ANDROID_INTERSTITIAL_ID?.trim() ?? '',
    rewarded: process.env.EXPO_PUBLIC_ADMOB_ANDROID_REWARDED_ID?.trim() ?? '',
  };
};

export const getAdUnitId = (adType: AdUnitType): string => {
  if (Platform.OS === 'web') {
    return '';
  }

  if (shouldUseTestIds()) {
    return Platform.OS === 'ios' ? testIds.ios[adType] : testIds.android[adType];
  }

  return getProductionAdUnitMap()[adType];
};

export const isTestAdUnitId = (adUnitId: string): boolean => {
  return adUnitId.includes(TEST_PUBLISHER_ID);
};

export const getAdRequestOptions = () => {
  return {
    requestNonPersonalizedAdsOnly: boolFromEnv(process.env.EXPO_PUBLIC_ADMOB_NPA_ONLY, true),
  };
};
