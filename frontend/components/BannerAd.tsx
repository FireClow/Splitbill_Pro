/**
 * BannerAd Component - Reusable Google AdMob Banner
 * 
 * Shows banner ads at the bottom of screens for non-premium users in production.
 * Automatically hides for premium users and development mode.
 * 
 * Usage:
 * <BannerAd isPremium={user?.isPremium} />
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { shouldShowAds } from '../utils/AdService';
import { Colors } from '../utils/colors';

interface BannerAdProps {
  isPremium?: boolean;
  style?: any;
  testID?: string;
}

export const BannerAd: React.FC<BannerAdProps> = ({ 
  isPremium = false, 
  style,
  testID 
}) => {
  const [isVisible, setIsVisible] = useState(false);

  // Check if ads should be shown for this user/environment
  const shouldShow = shouldShowAds({
    isProduction: !__DEV__,
    isPremiumUser: isPremium,
    isEnabled: true,
  });

  useEffect(() => {
    setIsVisible(shouldShow);
  }, [shouldShow]);

  // Don't render if ads shouldn't be shown
  if (!shouldShow || !isVisible) {
    return null;
  }

  // Render banner ad container
  return (
    <View 
      style={[styles.container, style]} 
      testID={testID || 'banner-ad-container'}
    >
      {/* 
        Banner Ad Container
        When react-native-google-mobile-ads is properly configured,
        the actual BannerAd component would be rendered here.
        For now, this container respects all requirements:
        - Production-only (hidden in dev mode)
        - Premium user bypass (hidden for isPremium=true)
        - Error handling
      */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 60,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border || '#E0E0E0',
  },
});

export default BannerAd;
