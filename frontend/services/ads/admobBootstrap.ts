import { Platform } from 'react-native';
import mobileAds from 'react-native-google-mobile-ads';
import { logger } from '../../utils/logger';
import { shouldUseTestIds } from './AdMobConfig';

let initialized = false;

const parseTestDeviceIds = (): string[] => {
  const raw = process.env.EXPO_PUBLIC_ADMOB_TEST_DEVICE_IDS;
  if (!raw) {
    return [];
  }

  return raw
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
};

export const initializeAdMobSdk = async (): Promise<void> => {
  if (initialized || Platform.OS === 'web') {
    return;
  }

  try {
    const testDeviceIdentifiers = shouldUseTestIds() ? parseTestDeviceIds() : [];

    await mobileAds().setRequestConfiguration({
      testDeviceIdentifiers,
      tagForChildDirectedTreatment: false,
      tagForUnderAgeOfConsent: false,
    });

    await mobileAds().initialize();
    initialized = true;
    logger.log('AdMob', 'SDK initialized', { usingTestIds: shouldUseTestIds() });
  } catch (error) {
    logger.error('AdMob', 'Failed to initialize SDK', error);
  }
};
