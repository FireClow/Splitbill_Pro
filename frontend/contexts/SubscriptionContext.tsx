import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import Purchases, { CustomerInfo, PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import { useAuth } from './AuthContext';
import { getRevenueCatApiKey, PREMIUM_ENTITLEMENT_ID } from '../constants/monetization';
import { logger } from '../utils/logger';

interface SubscriptionContextValue {
  isPremium: boolean;
  isLoading: boolean;
  offerings: PurchasesOffering | null;
  isConfigured: boolean;
  purchasePackage: (pkg: PurchasesPackage) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  refreshSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextValue>({
  isPremium: false,
  isLoading: true,
  offerings: null,
  isConfigured: false,
  purchasePackage: async () => false,
  restorePurchases: async () => false,
  refreshSubscription: async () => {},
});

const hasPremiumEntitlement = (customerInfo: CustomerInfo | null): boolean => {
  if (!customerInfo) {
    return false;
  }

  return Boolean(customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID]);
};

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(false);
  const [offerings, setOfferings] = useState<PurchasesOffering | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const configuredUserRef = useRef<string | undefined>(undefined);
  const customerInfoListenerRef = useRef<((customerInfo: CustomerInfo) => void) | null>(null);

  const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

  const refreshSubscription = useCallback(async () => {
    if (!isNative || !isConfigured) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const [customerInfo, allOfferings] = await Promise.all([
        Purchases.getCustomerInfo(),
        Purchases.getOfferings(),
      ]);

      setIsPremium(hasPremiumEntitlement(customerInfo));
      setOfferings(allOfferings.current ?? null);
    } catch (error) {
      logger.warn('Subscription', 'Failed to refresh subscription state', error);
    } finally {
      setIsLoading(false);
    }
  }, [isConfigured, isNative]);

  useEffect(() => {
    const configure = async () => {
      if (!isNative) {
        setIsLoading(false);
        return;
      }

      const apiKey = getRevenueCatApiKey();
      if (!apiKey) {
        logger.warn('Subscription', 'RevenueCat API key missing; premium purchases disabled');
        setIsLoading(false);
        return;
      }

      try {
        if (!isConfigured) {
          await Purchases.setLogLevel(Purchases.LOG_LEVEL.WARN);
          await Purchases.configure({
            apiKey,
            appUserID: user?.user_id,
          });

          configuredUserRef.current = user?.user_id;

          const onCustomerInfoUpdated = (customerInfo: CustomerInfo) => {
            setIsPremium(hasPremiumEntitlement(customerInfo));
          };

          customerInfoListenerRef.current = onCustomerInfoUpdated;
          Purchases.addCustomerInfoUpdateListener(onCustomerInfoUpdated);
        } else if (configuredUserRef.current !== user?.user_id) {
          if (user?.user_id) {
            await Purchases.logIn(user.user_id);
          } else {
            await Purchases.logOut();
          }
          configuredUserRef.current = user?.user_id;
        }

        setIsConfigured(true);
      } catch (error) {
        logger.warn('Subscription', 'RevenueCat configure failed', error);
        setIsConfigured(false);
        setIsLoading(false);
      }
    };

    configure();
  }, [isConfigured, isNative, user?.user_id]);

  useEffect(() => {
    return () => {
      if (customerInfoListenerRef.current) {
        Purchases.removeCustomerInfoUpdateListener(customerInfoListenerRef.current);
      }
      customerInfoListenerRef.current = null;
    };
  }, []);

  useEffect(() => {
    refreshSubscription();
  }, [refreshSubscription]);

  const purchasePackage = useCallback(async (pkg: PurchasesPackage): Promise<boolean> => {
    if (!isConfigured) {
      return false;
    }

    try {
      const purchaseResult = await Purchases.purchasePackage(pkg);
      const premium = hasPremiumEntitlement(purchaseResult.customerInfo);
      setIsPremium(premium);
      return premium;
    } catch (error: any) {
      if (!error?.userCancelled) {
        logger.warn('Subscription', 'Purchase failed', error);
      }
      return false;
    }
  }, [isConfigured]);

  const restorePurchases = useCallback(async (): Promise<boolean> => {
    if (!isConfigured) {
      return false;
    }

    try {
      const customerInfo = await Purchases.restorePurchases();
      const premium = hasPremiumEntitlement(customerInfo);
      setIsPremium(premium);
      return premium;
    } catch (error) {
      logger.warn('Subscription', 'Restore purchases failed', error);
      return false;
    }
  }, [isConfigured]);

  const value = useMemo<SubscriptionContextValue>(() => ({
    isPremium,
    isLoading,
    offerings,
    isConfigured,
    purchasePackage,
    restorePurchases,
    refreshSubscription,
  }), [isPremium, isLoading, offerings, isConfigured, purchasePackage, restorePurchases, refreshSubscription]);

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
};

export const useSubscription = (): SubscriptionContextValue => useContext(SubscriptionContext);
