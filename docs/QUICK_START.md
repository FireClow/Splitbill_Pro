# AdMob Quick Start - Next Steps

## 🎯 Your Implementation is Complete!

You now have a fully implemented Google AdMob monetization system with:
- ✅ Banner ads on home screen
- ✅ Interstitial ads every 3 bill creations
- ✅ Premium user support (no ads for paid users)
- ✅ Production-only ads (disabled in dev)
- ✅ Clean architecture and type-safe code
- ✅ Complete privacy policy
- ✅ Comprehensive documentation

---

## ⚡ To Get It Running

### 1. Test Right Now (With Test Ads)
```bash
cd frontend
npm install react-native-google-mobile-ads
npm run web
```

The app will use **Google's safe test ad IDs** automatically. Banner ads will show on home screen.

### 2. Create Your AdMob Account (5-10 minutes)
1. Go to https://admob.google.com
2. Sign in with your Google Account
3. Create new app (Android)
4. Create new app (iOS)
5. Create ad units (get your own IDs)

### 3. Update Your Configuration (2 minutes)
Edit `frontend/utils/AdMobConfig.ts`:

Find these lines and replace with YOUR IDs:
```typescript
// Line 8-12
appId: 'ca-app-pub-YOUR_ID~YOUR_CODE',  // ← Replace with your App ID
// Line 19-20 and 23-24 - replace the productionIds with YOUR ad unit IDs
```

### 4. Update Privacy Policy (3 minutes)
Edit `docs/PRIVACY_POLICY.md`:

Find and replace:
- `[your-email@example.com]` → your email
- `[Your Company Address]` → your address

### 5. Build & Test (5 minutes)
```bash
# Build release version
npm run build:web

# Or for mobile
eas build --platform android --profile preview
```

### 6. Monitor in AdMob Console
1. Log in to https://admob.google.com
2. Watch impressions and clicks
3. Monitor earnings
4. Check for errors

---

## 📁 Key Files to Know

| File | Purpose | Action |
|------|---------|--------|
| `frontend/utils/AdMobConfig.ts` | Ad IDs & settings | ✏️ **UPDATE** with your IDs |
| `docs/PRIVACY_POLICY.md` | Legal document | ✏️ **UPDATE** with your info |
| `docs/ADMOB_SETUP_GUIDE.md` | Detailed setup | 📖 **READ** for full guide |
| `frontend/components/BannerAd.tsx` | Banner component | 🔍 Review how it works |
| `frontend/hooks/useInterstitialAd.ts` | Frequency hook | 🔍 Review integration |
| `frontend/utils/AdService.ts` | Ad management | 🔍 View centralized logic |

---

## 🚀 Publishing Checklist

### Google Play Store (Android)

```
App Settings
├── [ ] Content Rating
│   └── "Ads or monetization" → YES
├── [ ] Store Listing
│   └── Add to description: "This app contains ads powered by Google AdMob"
├── [ ] Privacy Policy
│   └── Link to your updated docs/PRIVACY_POLICY.md
└── [ ] Signature section complete

Before Publishing
└── [ ] Production IDs in AdMobConfig.ts (not test IDs!)
```

### Apple App Store (iOS)

```
App Information
├── [ ] Age Rating includes "Frequent/Intense Ads"
├── [ ] Privacy Policy URL set
├── [ ] "Advertisers" capability enabled
└── [ ] App Store description mentions ads

Before Submitting
└── [ ] Privacy Policy updated
└── [ ] Production IDs configured
```

---

## 💡 How It Works

### Banner Ads (Home Screen)
```
User opens app
    ↓
Home screen renders
    ↓
BannerAd component checks:
  "Is production?" → YES (in release build)
  "Is user premium?" → NO (free tier)
  → Shows banner ad at bottom
```

### Interstitial Ads (Every 3 Bills)
```
User creates bill #1
  → trackBillCreation() called
  → Count = 1 (< 3, no ad)

User creates bill #2
  → Count = 2 (< 3, no ad)

User creates bill #3
  → Count = 3 (= 3, SHOW AD!)
  → Full-screen interstitial appears
  → User closes
  → Count resets to 0
  → Next ad shows after 3 more bills
```

### Premium User Path
```
If user.isPremium = true
  → All ads hidden automatically
  → No ads ever shown
  → Perfect for paid tier users
```

---

## 🔧 Configuration Options

### Change Ad Frequency
In `frontend/utils/AdMobConfig.ts`, change this:
```typescript
interstitialFrequency: 3  // Show every 3 bills (change number here)
```

### Enable/Disable Features
```typescript
features: {
  enableBannerAds: true,       // false to disable banners
  enableInterstitialAds: true, // false to disable interstitials
  interstitialFrequency: 3,    // Change this to 5, 10, etc.
}
```

---

## ✅ Test Checklist

In Development (`npm run web`):
- [ ] App opens without errors
- [ ] Home screen displays
- [ ] No banner ads show (test IDs used)
- [ ] Console logs show "[AdMob] Initialize" messages
- [ ] Create 3 bills - check console for frequency counting

In Release Build:
- [ ] Replace test IDs with production IDs
- [ ] Build release APK/IPA
- [ ] Install on device
- [ ] Banner ads appear on home screen
- [ ] Full-screen interstitial after 3 bills
- [ ] Check AdMob dashboard for impressions

---

## 🆘 Common Issues

**Problem:** Ads not showing  
**Solution:** Check if `__DEV__` is true (dev mode hides ads). Build in release mode.

**Problem:** App crashes  
**Solution:** See full troubleshooting in `docs/ADMOB_SETUP_GUIDE.md` page 3

**Problem:** Invalid ad IDs  
**Solution:** Copy-paste from AdMob console exactly. Wait 2-3 hours after creating new units.

**Problem:** Can't find AdMob console  
**Solution:** Go to https://admob.google.com and sign in with your Google Account

---

## 📚 Documentation

Read these in order:

1. **ADMOB_ARCHITECTURE.md** (10 min) - How it all connects
2. **ADMOB_SETUP_GUIDE.md** (30 min) - Detailed step-by-step
3. **PRIVACY_POLICY.md** (5 min) - Update with your info
4. **IMPLEMENTATION_SUMMARY.md** (10 min) - Overview of everything

---

## 🎓 Important Notes

### Test IDs vs Production IDs
- **Development:** Uses safe test IDs automatically
- **Release:** Automatically switches to production IDs
- **No manual change needed** - happens automatically based on build mode

### Privacy Compliance
- Update the Privacy Policy template with YOUR information
- Link it in your app settings
- Include it in app store listings
- This is REQUIRED for app store approval

### Invalid Activity
- Use test devices to avoid invalid activity warnings
- Never click your own ads
- Monitor AdMob console daily first week
- If you see warnings, contact AdMob support immediately

---

## 🎯 Success Metrics

After launching, monitor these in AdMob console:

| Metric | Good Range | Action If Low |
|--------|-----------|--------------|
| Impressions | Growing | Increase frequency or add more placements |
| CTR (%) | 1-5% | Check ad relevance |
| eCPM ($) | $0.50+ | Optimize placement/frequency |
| Invalid Traffic | <1% | Investigate and fix |

---

## 🏁 You're Ready!

Everything is set up and waiting for you to:

1. ✅ Create AdMob account  
2. ✅ Get your IDs  
3. ✅ Update configuration  
4. ✅ Update privacy policy  
5. ✅ Build and launch!

Questions? Check the detailed guides in `/docs` folder.

Good luck with your monetization! 🚀

---

**Questions?**
- AdMob Help: https://support.google.com/admob
- Privacy Questions: Check PRIVACY_POLICY.md
- Technical Issues: See ADMOB_SETUP_GUIDE.md Troubleshooting section
