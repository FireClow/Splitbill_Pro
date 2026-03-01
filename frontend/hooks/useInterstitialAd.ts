/**
 * InterstitialAdManager Hook
 * 
 * React hook for managing interstitial ad display with frequency control.
 * Automatically shows ads every N bill creations (default: 3).
 * Respects premium user status and development mode.
 * 
 * @param isPremium - Whether current user has premium subscription
 * @returns { trackBillCreation, getFrequencyCount }
 * 
 * Usage:
 * const { trackBillCreation, getFrequencyCount } = useInterstitialAd(user?.isPremium);
 * await trackBillCreation(); // Call after successful action
 */

import { useEffect, useCallback, useRef } from 'react';
import { getInterstitialAdManager, shouldShowAds } from '../utils/AdService';

interface UseInterstitialAdReturn {
  trackBillCreation: () => Promise<void>;
  getFrequencyCount: () => number;
}

export const useInterstitialAd = (isPremium: boolean = false): UseInterstitialAdReturn => {
  const managerRef = useRef(getInterstitialAdManager());

  // Check if ads should be shown
  const shouldShow = shouldShowAds({
    isProduction: !__DEV__,
    isPremiumUser: isPremium,
    isEnabled: true,
  });

  useEffect(() => {
    return () => {
      // Cleanup on unmount if needed
      // Note: We keep the manager alive for app lifetime
    };
  }, []);

  const trackBillCreation = useCallback(async () => {
    if (!shouldShow) {
      console.log('[useInterstitialAd] Ads disabled for this user');
      return;
    }

    try {
      await managerRef.current.trackBillCreation();
    } catch (error) {
      console.log('[useInterstitialAd] Error tracking bill creation:', error);
    }
  }, [shouldShow]);

  const getFrequencyCount = useCallback(() => {
    return managerRef.current.getFrequencyCount();
  }, []);

  return {
    trackBillCreation,
    getFrequencyCount,
  };
};
