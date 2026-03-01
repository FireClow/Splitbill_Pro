# AdMob Implementation Architecture

Complete guide to the Google AdMob monetization implementation in SplitBill.

## Overview

SplitBill uses Google AdMob for non-intrusive monetization with these key features:

- ✅ **Reusable Banner Ad Component** - Easy integration across screens
- ✅ **Interstitial Ad Management** - Frequency-controlled (every 3 bill creations)
- ✅ **Production-Only Ads** - Disabled in development mode
- ✅ **Premium User Support** - Features flag prevents ads for premium users
- ✅ **Centralized Service** - Single source of truth for ad logic
- ✅ **Clean Architecture** - Separation of concerns with hooks and services
- ✅ **Error Handling** - Graceful failure if ads don't load
- ✅ **Privacy-Compliant** - Comprehensive Privacy Policy included

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    User Interface Layer                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  home.tsx ──────┐  create-bill.tsx ──────┐  other screens  │
│  (Shows Banner) │  (Tracks Billing)      │                │
│                 │                         │                │
└─────────────────┼─────────────────────────┼────────────────┘
                  │                         │
                  └─────────┬───────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│           Hooks & Component Layer                            │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  BannerAd Component ◄──┐                                    │
│  ├─ Displays ads      │                                    │
│  ├─ Premium bypass    │                                    │
│  └─ Error handling    │  useInterstitialAd Hook            │
│                       │  ├─ trackBillCreation()            │
│                       │  ├─ Frequency control              │
│                       │  └─ Premium user bypass            │
│                       │                                     │
└───────────────────────┼─────────────────────────────────────┘
                        │
                        │ Uses
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              Ad Service & Manager Layer                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  AdService.ts (Centralized Management)                      │
│  ├─ BannerAdService                                         │
│  │  ├─ Event handling (loaded, error, closed)             │
│  │  ├─ Ad unit ID management                              │
│  │  └─ Platform detection                                 │
│  │                                                          │
│  └─ InterstitialAdManager (Singleton)                       │
│     ├─ Ad loading & caching                                │
│     ├─ Frequency control (every 3 bills)                   │
│     ├─ Error recovery with retry                           │
│     └─ Event lifecycle management                          │
│                                                               │
└──────────────────────┬──────────────────────────────────────┘
                       │ Uses
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         Configuration & React Native Ads SDK                │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  AdMobConfig.ts ◄──┐                                       │
│  ├─ Test IDs      │ getAdUnitId()                         │
│  ├─ Prod IDs      │ shouldShowAds()                       │
│  ├─ Features      │ AdEnvironment helpers                 │
│  └─ Constants     │                                        │
│                  │                                         │
│  react-native-google-mobile-ads                            │
│  ├─ BannerAd                                               │
│  ├─ InterstitialAd                                         │
│  └─ AdEventType                                            │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Google AdMob Backend                            │
├─────────────────────────────────────────────────────────────┤
│  ├─ Ad serving                                              │
│  ├─ Impressions & clicks tracking                           │
│  ├─ Revenue attribution                                     │
│  └─ Analytics                                               │
└─────────────────────────────────────────────────────────────┘
```

## File Structure

```
frontend/
├── components/
│   └── BannerAd.tsx                    # Reusable banner ad component
│
├── hooks/
│   └── useInterstitialAd.ts            # React hook for interstitial tracking
│
├── utils/
│   ├── AdService.ts                    # Centralized ad management
│   └── AdMobConfig.ts                  # Configuration & test IDs
│
├── contexts/
│   └── AuthContext.tsx                 # Updated with isPremium flag
│
└── app/
    ├── create-bill.tsx                 # Integrated ad tracking
    └── (tabs)/
        └── home.tsx                    # Integrated banner ad
```

## Core Components

### 1. **BannerAd Component** (`components/BannerAd.tsx`)

Reusable banner ad component with automatic premium bypass.

```tsx
import BannerAd from '../../components/BannerAd';

// In your screen
export default function MyScreen() {
  const { user } = useAuth();
  
  return (
    <View>
      {/* Your content */}
      <BannerAd isPremium={user?.isPremium} />
    </View>
  );
}
```

**Features:**
- Automatic production-only ads (disabled in dev)
- Premium user detection - no ads for paid users
- Error handling with retry logic
- Adaptive banner sizing
- Transparent placeholder during loading

### 2. **AdService** (`utils/AdService.ts`)

Centralized ad management with two main services:

#### BannerAdService
```typescript
const bannerService = new BannerAdService();
const isLoaded = bannerService.isAdLoaded();
const unitId = bannerService.getAdUnitId();
bannerService.handleAdEvent(eventName); // Manage lifecycle
```

#### InterstitialAdManager (Singleton)
```typescript
const manager = getInterstitialAdManager();

// Track bill creation - shows ad every 3 times
await manager.trackBillCreation();

// Get current count
const count = manager.getFrequencyCount();

// Manual control
await manager.show();
manager.setFrequency(5); // Custom frequency
```

**Key Logic:**
```typescript
function shouldShowAds(config: AdConfig): boolean {
  return config.isProduction && !config.isPremiumUser && config.isEnabled;
}
```

### 3. **useInterstitialAd Hook** (`hooks/useInterstitialAd.ts`)

React hook for easy integration in components:

```typescript
import { useInterstitialAd } from '../hooks/useInterstitialAd';

export default function CreateBillScreen() {
  const { user } = useAuth();
  const { trackBillCreation, getFrequencyCount } = useInterstitialAd(user?.isPremium);
  
  const handleSave = async () => {
    // ... create bill logic ...
    await api.createBill(billData);
    
    // Track for ad frequency - shows ad every 3 bills
    await trackBillCreation();
    
    // Navigate to bill
    router.push(`/bill/${result.bill_id}`);
  };
}
```

### 4. **AdMobConfig** (`utils/AdMobConfig.ts`)

Configuration file with test and production IDs:

```typescript
import { getAdUnitId, AdEnvironment, ADMOB_CONFIG } from '../utils/AdMobConfig';

// Get appropriate ID based on environment
const bannerId = getAdUnitId('banner'); // Returns test ID in dev, prod in release

// Check environment
if (AdEnvironment.isProduction()) {
  // Production code
}

if (AdEnvironment.isAndroid()) {
  // Android-specific code
}
```

**Smart Environment Detection:**
- **Development Mode** (`__DEV__ === true`):
  - Uses Google's safe test ad IDs
  - No real impressions/clicks counted
  - Safe to use without restrictions

- **Production Mode** (`__DEV__ === false`):
  - Uses your actual production ad unit IDs
  - Real ads served
  - Revenue tracked and paid

## Data Flow

### Banner Ad Display Flow

```
User Opens Screen
       │
       ▼
┌─────────────────────┐
│ BannerAd Component  │
│ Receives isPremium  │
└────────┬────────────┘
         │
         ▼
    Is Production &
    Is Not Premium?
    /            \
  YES            NO
   │              │
   ▼              ▼
Load Ad      Don't Show
   │
   ▼
AdMobConfig.getAdUnitId('banner')
   │
   ▼
Return Test ID (dev) or Prod ID (release)
   │
   ▼
React Native Google Mobile Ads SDK
   │
   ▼
Google AdMob Backend
   │
   ▼
Ad Served to User
   │
   ▼
OnLoadEvent → BannerAd.handleAdEvent()
   │
   ▼
Display to User or Show Error
```

### Interstitial Ad Frequency Flow

```
User Creates Bill Successfully (1st time)
       │
       ▼
create-bill.tsx calls trackBillCreation()
       │
       ▼
useInterstitialAd Hook
       │
       ▼
InterstitialAdManager.trackBillCreation()
       │
       ├─ billCreationCount = 1
       ├─ Check: 1 < 3 (frequency)?
       └─ No → Just track
       │
       ▼
User Creates Bill (2nd time)
       │
       ▼
billCreationCount = 2
Check: 2 < 3?
No → Just track
       │
       ▼
User Creates Bill (3rd time) ◄─────┐
       │                              │
       ▼                              │
billCreationCount = 3                │
Check: 3 >= 3?                       │
YES → Call manager.show()            │
       │                              │
       ▼                              │
Google AdMob Interstitial Ad          │
       │                              │
       ▼                              │
User Sees Full-Screen Ad             │
       │                              │
       ▼                              │
User Closes Ad (OnClosedEvent)       │
       │                              │
       ▼                              │
resetFrequency() → billCreationCount = 0
       │                              │
       ▼                              │
reload Ad for next cycle ─────────────┘
```

## Integration Points

### 1. **Home Screen** - Banner Ad
```tsx
// app/(tabs)/home.tsx
import { useAuth } from '../../contexts/AuthContext';
import BannerAd from '../../components/BannerAd';

export default function HomeScreen() {
  const { user } = useAuth();
  // ... component code ...
  return (
    <SafeAreaView>
      {/* content */}
      <BannerAd isPremium={user?.isPremium} />
    </SafeAreaView>
  );
}
```

### 2. **Create Bill Screen** - Interstitial Tracking
```tsx
// app/create-bill.tsx
import { useAuth } from '../contexts/AuthContext';
import { useInterstitialAd } from '../hooks/useInterstitialAd';

export default function CreateBillScreen() {
  const { user } = useAuth();
  const { trackBillCreation } = useInterstitialAd(user?.isPremium);
  
  const handleSave = async () => {
    // ... validation ...
    const result = await api.createBill(billData);
    
    // Track for ad frequency
    await trackBillCreation();
    
    router.replace(`/bill/${result.bill_id}`);
  };
}
```

### 3. **Auth Context** - Premium Flag
```typescript
// contexts/AuthContext.tsx
interface User {
  user_id: string;
  email: string;
  name: string;
  picture?: string;
  isPremium?: boolean; // ← Feature flag for ad control
}
```

## Premium User Feature Flag

### How It Works

1. **User Data Includes Premium Status:**
```typescript
const user = {
  user_id: "123",
  name: "John",
  email: "john@example.com",
  isPremium: true, // Premium feature flag
};
```

2. **Premium Users See No Ads:**
```typescript
// shouldShowAds() logic
if (isPremiumUser) {
  return false; // Don't show ads
}
```

3. **Future Enhancement - Upgrade Screen:**
```typescript
// Can add upgrade button to show premium benefits
const features = [
  { icon: '✓', text: 'No advertisements' },
  { icon: '✓', text: 'Advanced analytics' },
  { icon: '✓', text: 'Family plan support' },
];
```

## Testing Checklist

### Development Testing
- [ ] Banner ads render on home screen
- [ ] Banner ads don't appear when `isPremium = true`
- [ ] Interstitial doesn't show in `__DEV__` mode
- [ ] App doesn't crash on ad load error
- [ ] Console logs show correct ad unit IDs (test IDs)
- [ ] Frequency counter increments correctly
- [ ] Ad shows after 3rd bill creation

### Production Testing (Before Launch)
- [ ] Replace test IDs with production IDs in `AdMobConfig.ts`
- [ ] Build release APK/IPA
- [ ] Test on real device
- [ ] Banner ads appear on release build
- [ ] Interstitial ads trigger correctly
- [ ] Premium user bypass works
- [ ] Monitor AdMob console for impressions
- [ ] Check for invalid traffic warnings

## Configuration Reference

### AdMobConfig.ts Structure

```typescript
ADMOB_CONFIG = {
  appId: 'ca-app-pub-xxxxxxxxxxxxxxxx~yyyyyyyyyy',
  android: {
    testIds: { /* Safe test IDs */ },
    productionIds: { /* Your real IDs */ },
  },
  ios: {
    testIds: { /* Safe test IDs */ },
    productionIds: { /* Your real IDs */ },
  },
  features: {
    enableBannerAds: true,
    enableInterstitialAds: true,
    enableRewardedAds: false,
    interstitialFrequency: 3, // Every 3 bills
  },
}
```

### Environment Detection

```typescript
__DEV__ === true  → Uses test IDs & Test Mode
__DEV__ === false → Uses production IDs & Real Ads
```

## Monitoring & Debugging

### Console Logs (Development)

Look for these logs to verify integration:

```
[AdMob] BannerAd - Ad loaded successfully
[AdService] Banner ad loaded
[AdService] Bill created (1/3)
[AdService] Bill created (2/3)
[AdService] Bill created (3/3)
[AdService] Interstitial ad loaded
[AdService] Frequency counter reset
```

### Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| Ads don't show | `__DEV__` is true or `isPremium` is true | Use release build or test with `isPremium: false` |
| App crashes on ad load | Missing error handling | Check BannerAd try-catch blocks |
| Wrong ad ID used | Environment detection failed | Verify `__DEV__` and AdMobConfig |
| Premium flag ignored | Not passed correctly | Check `user?.isPremium` is propagated |

## Performance Considerations

### Memory Management
- Interstitial ads preloaded in background
- Singleton pattern prevents multiple instances
- Old ads cleaned up on closure

### Network Optimization
- Ads cached after loading
- Retry logic for failed loads
- Batched ad requests to Google

### UX Impact
- Minimal banner ad height (60px)
- Interstitial only on natural pauses (after 3 bills)
- No ad-blocking of content

## Compliance & Privacy

### GDPR Compliance
- Privacy Policy references Google's practices
- Users can disable personalized ads
- No forced ad tracking in EU

### CCPA Compliance
- Users can opt-out of data sales
- Privacy Policy explains data use
- Respects "Do Not Track" signals

### Ad Quality Standards
- NO auto-click ads
- NO misleading ads
- NO covering content with ads
- NO interrupting user experience

See `docs/PRIVACY_POLICY.md` for full compliance details.

## Migration Guide (From No Ads)

If upgrading from a version without ads:

1. **Install Package:**
```bash
cd frontend
npm install react-native-google-mobile-ads
```

2. **Update Files:**
   - Create new: `utils/AdService.ts`
   - Create new: `utils/AdMobConfig.ts`
   - Create new: `components/BannerAd.tsx`
   - Create new: `hooks/useInterstitialAd.ts`
   - Update: `contexts/AuthContext.tsx`
   - Update: `app/create-bill.tsx`
   - Update: `app/(tabs)/home.tsx`

3. **Test:**
   - Run in development mode
   - Verify test ads show (with "Test App" label)
   - Create 3 bills and check interstitial

4. **Configuration:**
   - Update `AdMobConfig.ts` with your app IDs
   - Get production ad unit IDs from AdMob console

5. **Launch:**
   - Update Privacy Policy
   - Build release version
   - Monitor AdMob console

## Next Steps

1. [Read AdMob Setup Guide](./ADMOB_SETUP_GUIDE.md)
2. [Review Privacy Policy](./PRIVACY_POLICY.md)
3. Create AdMob account and get IDs
4. Update `AdMobConfig.ts` with your IDs
5. Test on development device
6. Monitor AdMob console
7. Launch with confidence! 🚀

---

**Questions?** Check the guides in `/docs` or contact AdMob support.
