# Split Bill Monetization Roadmap (Future Ready)

## Current position

- Keep core experience free and stable.
- Do not block critical bill flow with ads.
- Use ad placeholders and feature flags first.

## Phase 1 (Now): Safe foundation

- Banner + interstitial architecture prepared.
- Premium flag already available in app logic.
- Ads disabled on web and dev.

## Phase 2 (Early growth)

- Add real AdMob Android IDs.
- Interstitial frequency: every 3 successful bill creations.
- Never show ad during data input step.

## Phase 3 (Retention focus)

Introduce optional premium plan:

- Remove ads
- Extra export formats
- Advanced analytics
- Multi-device sync priority

## Phase 4 (Revenue expansion)

- Add in-app purchase (one-time or subscription)
- Add feature-gated OCR credits only if infrastructure cost increases

## UX guardrails

- Never show ad before first successful bill creation
- Never show ad on error/retry screens
- Keep loading and empty states clean
- Preserve fast bill creation path

## Technical guardrails

- Keep monetization behind config flags
- Keep billing logic separate from UI components
- Avoid hardcoded ad IDs in source for production

## KPI to track before scaling monetization

- Day-1 and Day-7 retention
- Bills created per active user
- Crash-free sessions
- Ad fill rate and eCPM (once ads are live)
