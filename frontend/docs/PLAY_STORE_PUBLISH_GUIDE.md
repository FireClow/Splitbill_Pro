# Split Bill Android Publish Guide (Zero Cost)

This guide is for beginner-friendly production publishing using free tools (Expo + Google Play Console).

## 1. Pre-check

- Ensure app runs locally: `npm run web` and backend is healthy.
- Ensure lint passes: `npm run lint`.
- Ensure backend tests pass.
- Verify `frontend/app.json` has:
  - android.package
  - android.versionCode
  - app version

## 2. Build release AAB (free)

Run from `frontend`:

```bash
npx eas-cli login
npx eas-cli build --platform android --profile production
```

Output: Android App Bundle (`.aab`) from EAS build artifact.

## 3. Bump version before each release

In `frontend/app.json`:

- Increase `expo.version` (example `1.0.1`)
- Increase `expo.android.versionCode` (must always increase)

## 4. Google Play Console setup

Prepare:

- App name: Split Bill
- Short description + full description
- App icon (512x512)
- Feature graphic (1024x500)
- Screenshots
- Privacy Policy URL

## 5. Data safety and permissions

Current app uses camera/image for receipt scan and local auth token storage.

Declare in Data Safety form:

- App functionality data processing (receipt image text extraction)
- No unnecessary sensitive permission access

## 6. Ads and monetization declaration

Current app is prepared for ads but does not force ads in dev or web.

If enabling production ads later:

- Update real AdMob IDs
- Complete Ads declaration in Play Console
- Update privacy policy with ad provider disclosure

## 7. Release checklist

- No crash on app launch
- Create bill flow works end-to-end
- OCR scan handles errors gracefully
- Empty states and retry states visible
- Version and versionCode updated
- AAB uploaded to internal testing first

## 8. Recommended rollout

- Internal testing (100%)
- Closed testing (small audience)
- Production staged rollout (10% -> 25% -> 50% -> 100%)

## 9. Free stack policy

Keep zero cost by default:

- Backend on free/local infra
- Local MongoDB for dev
- No paid OCR/API requirements for baseline flow
- Add paid services only when MAU grows and retention is proven
