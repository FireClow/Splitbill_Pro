# Google AdMob Integration Guide

Complete guide for setting up and managing Google AdMob in SplitBill.

## Table of Contents
1. [Initial Setup](#initial-setup)
2. [AdMob Account Configuration](#admob-account-configuration)
3. [Code Implementation](#code-implementation)
4. [Testing](#testing)
5. [Production Deployment](#production-deployment)
6. [Monitoring & Analytics](#monitoring--analytics)
7. [Troubleshooting](#troubleshooting)

---

## Initial Setup

### Prerequisites
- Google Account
- Google AdMob account (sign up at https://admob.google.com)
- SplitBill mobile app project

### Step 1: Create AdMob Account
1. Visit https://admob.google.com
2. Sign in with your Google Account
3. Accept AdMob terms and conditions
4. Set up your account information

---

## AdMob Account Configuration

### Step 2: Create App in AdMob

#### For Android:
1. Click "Apps" in the left menu
2. Click "Add App"
3. Select "Android"
4. Select "Google Play" as platform
5. Search for "SplitBill" in Play Store
6. OR select "Add app manually"
7. Fill in app details:
   - **App Name:** SplitBill
   - **Package Name:** com.splitbill (or your actual package)
8. Click "Create"
9. **Save your Android App ID** (format: ca-app-pub-xxxxxxxxxxxxxxxx~yyyyyyyyyy)

#### For iOS:
1. Click "Apps" in the left menu
2. Click "Add App"
3. Select "iOS"
4. Search for SplitBill in App Store
5. OR select "Add app manually"
6. Fill in app details:
   - **App Name:** SplitBill
   - **Bundle ID:** com.kenji.splitbill (or your actual bundle)
   - **App Store ID:** (only if already on App Store)
7. Click "Create"
8. **Save your iOS App ID** (format: ca-app-pub-xxxxxxxxxxxxxxxx~zzzzzzzzzz)

### Step 3: Create Ad Units

#### Banner Ad Unit (Android):
1. Go to "Ad Units" in the left menu (under your app)
2. Click "Create Ad Unit"
3. Select **Banner** format
4. Fill in:
   - **Name:** SplitBill Banner - Android
   - **Ad Format:** Banner
5. Click "Create"
6. Copy the **Ad Unit ID** (format: ca-app-pub-xxxxxxxxxxxxxxxx/6300978111)
7. Update in `frontend/utils/AdMobConfig.ts`:
   ```typescript
   android: {
     productionIds: {
       banner: 'ca-app-pub-YOUR_ANDROID_BANNER_ID/YOUR_SLOT_ID',
       // ...
     }
   }
   ```

#### Interstitial Ad Unit (Android):
1. Click "Create Ad Unit" (same location)
2. Select **Interstitial** format
3. Fill in:
   - **Name:** SplitBill Interstitial - Android
   - **Ad Format:** Interstitial
4. Click "Create"
5. Copy the **Ad Unit ID**
6. Update in `frontend/utils/AdMobConfig.ts`:
   ```typescript
   android: {
     productionIds: {
       interstitial: 'ca-app-pub-YOUR_ANDROID_INTERSTITIAL_ID/YOUR_SLOT_ID',
       // ...
     }
   }
   ```

#### Repeat for iOS App
Create the same ad units for iOS in your iOS app configuration with the same naming convention.

### Step 4: Add Test Devices

To avoid invalid activity warnings during development:

1. Go to **Settings** > **Test Devices**
2. Click "Add test device"
3. For Android:
   - Get your Advertising ID (Settings > Google > Manage your Google Account > Data & Privacy > Ad Settings)
   - Or run your app and check the Logcat output
   - Add the ID to AdMob test devices
4. For iOS:
   - Get your IDFA (Settings > Privacy > Apple Advertising > View AD ID)
   - Add to AdMob test devices

**Alternative:** Use Google's provided test IDs (already in the code for development)

---

## Code Implementation

### Current Architecture

```
frontend/
├── components/
│   └── BannerAd.tsx              # Reusable banner ad component
├── hooks/
│   └── useInterstitialAd.ts       # Hook for interstitial ad management
├── utils/
│   ├── AdService.ts              # Centralized ad service
│   └── AdMobConfig.ts            # Configuration & setup guide
└── app/
    ├── create-bill.tsx           # Integrated with interstitial tracking
    └── (tabs)/
        └── home.tsx              # Integrated banner ad
```

### Key Features Implemented

#### 1. AdService (Centralized Management)
```typescript
import { BannerAdService, getInterstitialAdManager } from '../utils/AdService';

// Banner ads
const service = new BannerAdService();

// Interstitial ads with frequency control
const manager = getInterstitialAdManager();
await manager.trackBillCreation(); // Shows ad every 3 bills
```

#### 2. BannerAd Component (Reusable)
```tsx
import BannerAd from '../components/BannerAd';

// In your screen
<BannerAd isPremium={user?.isPremium} />
```

**Features:**
- Automatic show/hide for premium users
- Production-only ads (disabled in dev)
- Error handling with retry
- Clean architecture

#### 3. Interstitial Ad Hook
```typescript
import { useInterstitialAd } from '../hooks/useInterstitialAd';

// In your component
const { trackBillCreation, getFrequencyCount } = useInterstitialAd(isPremium);

// Track bill creation (automatically shows ad every 3 times)
await trackBillCreation();
```

**Features:**
- Automatic frequency control (every 3 bills)
- Premium user bypass
- Frequency counter access

#### 4. Configuration File
```typescript
import { getAdUnitId, AdEnvironment } from '../utils/AdMobConfig';

// Get correct ad ID based on environment
const bannerId = getAdUnitId('banner');

// Check environment
if (AdEnvironment.isProduction()) {
  // production code
}
```

---

## Testing

### Development Mode (Test Ads)

1. The app automatically uses Google Test IDs in `__DEV__` mode
2. Test IDs provided in `AdMobConfig.ts`:
   - **Banner:** `ca-app-pub-3940256099942544/6300978111`
   - **Interstitial:** `ca-app-pub-3940256099942544/1033173712`

3. Test ads will show:
   - "Test App" text on banner ads
   - "Test" label on interstitial ads

### Manual Testing Checklist

- [ ] Banner ads appear on home screen in non-premium mode
- [ ] Banner ads do NOT appear for premium users
- [ ] Interstitial ads DO NOT show in development mode
- [ ] No ads appear when `__DEV__` is true
- [ ] Frequency counter works (logs every bill creation)
- [ ] Ad errors are handled gracefully
- [ ] App doesn't crash if ad fails to load
- [ ] Premium flag prevents all ads

### Test Device Configuration

```typescript
// In AdMobConfig.ts, test IDs are automatically used in dev mode
// BUT for final testing with production IDs:

// Option 1: Add device as test device in AdMob Console
// Settings > Test Devices > Add Device

// Option 2: Check logcat for device ID
// adb logcat | grep "Google Mobile Ads"

// Option 3: Use Gradle configuration in android/app/build.gradle
bundle {
  language {
    enableSplit = true
  }
}
```

---

## Production Deployment

### Pre-Launch Checklist

- [ ] Replace test IDs with production IDs in `AdMobConfig.ts`
- [ ] Privacy Policy updated and linked in app (`docs/PRIVACY_POLICY.md`)
- [ ] Test premium user pathway (ads disabled)
- [ ] Test all ad types on real devices
- [ ] Monitor AdMob console for invalid activity
- [ ] Remove test devices from AdMob settings
- [ ] Update app store listing with AdMob disclosure
- [ ] Verify GDPR compliance if needed

### Update Before Publishing

1. **Google Play Store (Android):**
   ```
   Content Rating
   - Verify "Ads or monetization" = Yes
   
   Store Listing
   - Add: "This app contains ads powered by Google AdMob"
   
   Privacy Policy
   - Link: docs/PRIVACY_POLICY.md
   ```

2. **iOS App Store:**
   ```
   App Information
   - Verify "Age Rating" includes ads
   
   Privacy
   - Add privacy policy URL
   - Add "Advertisers" capability
   - Add "Google" as third-party ad partner
   
   App Store Listing
   - Mention AdMob ads in description
   ```

### Production Ad Unit IDs

1. Navigate to `frontend/utils/AdMobConfig.ts`
2. Replace all `ca-app-pub-YOUR_*` with actual production IDs
3. Example:
   ```typescript
   android: {
     productionIds: {
       banner: 'ca-app-pub-1234567890123456/1111111111',
       interstitial: 'ca-app-pub-1234567890123456/2222222222',
     },
   }
   ```

### Environment-Based Ad Loading

```typescript
// Automatically handled by AdService.ts
// Development mode: Uses test IDs
// Production mode: Uses production IDs (when __DEV__ == false in release build)

if (__DEV__) {
  adUnitId = testIds.banner; // Safe test IDs
} else {
  adUnitId = productionIds.banner; // Real production IDs
}
```

---

## Monitoring & Analytics

### AdMob Console Dashboard

Watch these metrics:

1. **Impressions:** Number of ads served
   - Target: Increasing interstitial frequency for more revenue
   
2. **Clicks:** User interactions with ads
   - Target: 1-3% CTR (Click-Through Rate)
   
3. **Revenue:** Estimated earnings
   - Shows daily/weekly/monthly trends
   
4. **Invalid Traffic:** Suspicious activity
   - Target: < 1% to avoid account suspension
   - Monitor after initial launch

### Key Metrics to Track

| Metric | Target | Notes |
|--------|--------|-------|
| Impression Rate | High | More impressions = more revenue |
| eCPM (Earnings) | Optimize by region | Use audience targeting |
| Add-on Rate | > 50% | Frequency should not exceed 15 ads/day |
| CTR | 1-5% | Higher = better relevance |
| Invalid Activity | < 1% | High = account suspension risk |

### In-App Analytics Integration

To track user engagement with ads:

```typescript
// In your analytics service
import { Analytics } from '@segment/analytics-react-native';

Analytics.track('Ad Shown', {
  adType: 'interstitial',
  billCount: frequencyCount,
  userPlan: user?.isPremium ? 'premium' : 'free',
});

Analytics.track('Ad Clicked', {
  adType: 'banner',
  timestamp: new Date(),
});
```

---

## Troubleshooting

### Common Issues & Solutions

#### Problem: "Ad Unit ID not recognized"
**Solution:**
- Verify copypasta of Ad Unit ID from AdMob console
- Ensure correct platform (Android vs iOS)
- Wait 2-3 hours after creating new ad units

#### Problem: Ads don't load in development
**Solution:**
- This is normal! Development uses test IDs which may not always show ads
- Check logcat/console for error messages
- Ensure `__DEV__` is true
- Test with production IDs on test device

#### Problem: "Invalid Activity" warning
**Solution:**
- Stop generating impressions immediately
- Remove app from all test devices
- Check for invalid traffic patterns
- Contact AdMob support if issue persists

#### Problem: App crashes when loading ads
**Solution:**
- Check `BannerAd.tsx` error handling is intact
- Verify all imports are correct
- Check console for stack trace
- Ensure ad initialization is called

#### Problem: Ads show even though premium
**Solution:**
- Verify `isPremium` flag is being passed correctly
- Check `shouldShowAds()` logic in AdService
- Confirm premium user data is saved in AuthContext
- Clear app cache and re-test

#### Problem: Premium flag not persisting
**Solution:**
- Add to AuthContext persistence:
  ```typescript
  const login = async (sessionId: string) => {
    // ... existing code ...
    await AsyncStorage.setItem('user_premium', user.isPremium ? 'true' : 'false');
  };
  
  const checkAuth = async () => {
    // ... existing code ...
    const isPremium = await AsyncStorage.getItem('user_premium') === 'true';
    setUser({ ...user, isPremium });
  };
  ```

### Debug Logging

Enable detailed logging in development:

```typescript
// In AdService.ts
const DEBUG = __DEV__;

if (DEBUG) {
  console.log('[AdMob] Initialize', { appId, testMode: __DEV__ });
  console.log('[AdMob] Load Ad', { unitId, adType });
  console.log('[AdMob] Ad Event', { event, timestamp: new Date() });
}
```

### Contact AdMob Support

For persistent issues:
1. Go to https://support.google.com/admob
2. Click "Create a support case"
3. Provide:
   - App ID
   - Ad Unit IDs
   - Device info
   - Screenshots
   - Error logs

---

## Best Practices

### Ad Placement
✅ **DO:**
- Place banner ads at bottom of screens
- Show interstitial during natural pauses (after action completion)
- Space interstitial ads out (every 3+ actions)
- Show relevant ads to user interests

❌ **DON'T:**
- Cover content with ads
- Pop ads immediately on app launch
- Show ads faster than every 30 seconds
- Use misleading ad placement

### Frequency & User Experience
✅ **DO:**
- Offer premium tier with no ads
- Warn users before interstitial
- Allow easy ad dismissal
- Monitor revenue vs user retention

❌ **DON'T:**
- Overwhelm users with ads
- Make ad dismissal hard to find
- Force users to view ads
- Ignore user complaints

### Compliance
✅ **DO:**
- Include Privacy Policy
- Disclose AdMob usage
- Be transparent about data collection
- Update Privacy Policy regularly

❌ **DON'T:**
- Use misleading ad practices
- Collect data without consent
- Ignore GDPR/CCPA requirements
- Click own ads (!)

---

## Revenue Optimization

### Maximize eCPM (Earnings Per 1000 Impressions)

1. **Improve Ad Relevance:**
   - Enable personalized ads (if GDPR compliant)
   - Target specific user demographics
   - Use Google's machine learning for optimization

2. **Increase Impressions:**
   - Add interstitial ads at key moments
   - Increase frequency gradually (watch metrics)
   - A/B test different placements

3. **Optimize Audience:**
   - Focus on high-value regions (US, UK, DE)
   - Target users with higher purchasing power
   - Monitor CPM by country

4. **Monitor & Adjust:**
   - Review daily eCPM trends
   - Adjust frequency based on eCPM changes
   - Watch user retention (don't over-monetize)

### Example Revenue Projections

```
Assumptions:
- 1,000 DAU (Daily Active Users)
- 20% user engagement with ads
- Average eCPM: $2.50 USD

Daily Revenue: 1,000 × 20% × (2.50/1000) = $0.50/day
Monthly Revenue: ~$15
Yearly Revenue: ~$180
```

Note: Actual numbers vary extensively based on region, ad quality, and user demographics.

---

## Next Steps

1. ✅ Create AdMob account
2. ✅ Set up Android and iOS apps
3. ✅ Create banner and interstitial ad units
4. ✅ Update `AdMobConfig.ts` with your IDs
5. ✅ Update Privacy Policy with your contact info
6. ✅ Test on development devices
7. ✅ Prepare for production launch
8. ✅ Monitor AdMob console regularly

---

**Questions?** Check [Google AdMob Help Center](https://support.google.com/admob) or contact AdMob support directly.

Good luck monetizing SplitBill! 🚀
