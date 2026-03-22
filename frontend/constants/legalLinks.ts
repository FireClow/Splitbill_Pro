export const LEGAL_LINKS = {
  privacyPolicy:
    process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL?.trim() || 'https://splitbillpro.app/privacy-policy',
  termsOfService:
    process.env.EXPO_PUBLIC_TERMS_URL?.trim() || 'https://splitbillpro.app/terms-of-service',
};
