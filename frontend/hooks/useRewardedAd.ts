import { useCallback, useRef } from 'react';
import { getRewardedAdManager, shouldShowAds } from '../services/ads/AdService';
import { useSubscription } from '../contexts/SubscriptionContext';

interface UseRewardedAdReturn {
  showRewardedForUnlock: () => Promise<boolean>;
  isRewardedReady: () => boolean;
}

export const useRewardedAd = (isPremium: boolean = false): UseRewardedAdReturn => {
  const { isPremium: premiumFromSubscription } = useSubscription();
  const managerRef = useRef(getRewardedAdManager());
  const effectivePremium = isPremium || premiumFromSubscription;

  const canShowAds = shouldShowAds({
    isProduction: !__DEV__,
    isPremiumUser: effectivePremium,
    isEnabled: true,
  });

  const showRewardedForUnlock = useCallback(async (): Promise<boolean> => {
    if (!canShowAds) {
      return false;
    }

    return managerRef.current.showForReward();
  }, [canShowAds]);

  const isRewardedReady = useCallback((): boolean => {
    return canShowAds && managerRef.current.isReady();
  }, [canShowAds]);

  return {
    showRewardedForUnlock,
    isRewardedReady,
  };
};
