# SplitBill Pro - App Store Submission Checklist

## Apple App Store (iOS)

### Pre-Submission
- [ ] Apple Developer Account ($99/year)
- [ ] App ID registered in Apple Developer Portal
- [ ] Push notification certificates (if applicable)
- [ ] App Store Connect listing created

### Build & Signing
- [ ] Production build created: `eas build --platform ios`
- [ ] Distribution certificate configured
- [ ] Provisioning profile created
- [ ] Version number set (semver: 1.0.0)
- [ ] Build number incremented

### App Store Connect
- [ ] App name: "SplitBill Pro"
- [ ] Subtitle: "Split Bills & Track Payments"
- [ ] Category: Finance
- [ ] Age Rating: 4+ (no objectionable content)
- [ ] Price: Free (with In-App Purchases)

### Screenshots Required
- [ ] iPhone 6.7" (1290 x 2796) - 3 minimum
- [ ] iPhone 6.5" (1284 x 2778) - 3 minimum
- [ ] iPad Pro 12.9" (2048 x 2732) - optional but recommended
- Screenshots should show: Login, Dashboard, Bill Detail, Split View, Analytics

### Privacy & Permissions
- [ ] Privacy Policy URL provided
- [ ] App Privacy labels filled (Data Types: Name, Email, Usage Data)
- [ ] Camera permission description (for future OCR): "Scan receipts to automatically split bills"
- [ ] No tracking declaration (App Tracking Transparency not required if no tracking)

### In-App Purchase
- [ ] "Pro Plan" subscription product created
- [ ] Subscription Group: "SplitBill Pro Plans"
- [ ] Review information for test account provided

### Review Notes
- Provide test account credentials for reviewers
- Explain Google OAuth flow
- Note that payment integration uses Stripe (or IAP)

---

## Google Play Store (Android)

### Pre-Submission
- [ ] Google Play Console account ($25 one-time)
- [ ] App listing created
- [ ] Content rating questionnaire completed

### Build & Signing
- [ ] AAB (Android App Bundle) created: `eas build --platform android`
- [ ] Upload key generated
- [ ] Google Play App Signing enrolled
- [ ] Version code incremented

### Store Listing
- [ ] Title: "SplitBill Pro - Split Bills & Track Payments"
- [ ] Short description (80 chars): "Smart bill splitting, multi-currency, payment tracking"
- [ ] Full description (4000 chars)
- [ ] Category: Finance
- [ ] Content Rating: Everyone

### Graphics
- [ ] App icon: 512x512 PNG
- [ ] Feature graphic: 1024x500
- [ ] Phone screenshots: min 2, max 8 (16:9 recommended)
- [ ] Tablet screenshots: optional

### Data Safety
- [ ] Data collection declared (name, email, financial data)
- [ ] Data sharing: None
- [ ] Data encryption: Yes (in transit and at rest)
- [ ] Data deletion: Available via account deletion

### Subscription
- [ ] Subscription product created in Play Console
- [ ] Base plan: Monthly $4.99
- [ ] Grace period: 7 days
- [ ] Account hold: 30 days

---

## Versioning Strategy
- **Major.Minor.Patch** (Semantic Versioning)
- Major: Breaking changes or major feature releases
- Minor: New features, backward compatible
- Patch: Bug fixes
- Build number: Auto-increment with each build

## Release Pipeline
1. Develop on `feature/` branches
2. Merge to `staging` → Internal testing
3. Merge to `main` → Production build
4. Submit to stores → Review (1-3 days)
5. Gradual rollout (10% → 50% → 100%)
