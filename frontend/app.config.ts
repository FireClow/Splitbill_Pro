import type { ExpoConfig } from 'expo/config';
const appJson = require('./app.json') as { expo: ExpoConfig };

const baseConfig = appJson.expo;

const ensurePlugin = (plugins: ExpoConfig['plugins'] = []): ExpoConfig['plugins'] => {
  const filtered = plugins.filter((entry) => {
    if (typeof entry === 'string') {
      return entry !== 'react-native-google-mobile-ads';
    }

    if (Array.isArray(entry)) {
      return entry[0] !== 'react-native-google-mobile-ads';
    }

    return true;
  });

  const androidAppId = process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID?.trim() || 'ca-app-pub-3940256099942544~3347511713';
  const iosAppId = process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID?.trim() || 'ca-app-pub-3940256099942544~1458002511';

  filtered.push([
    'react-native-google-mobile-ads',
    {
      androidAppId,
      iosAppId,
    },
  ]);

  return filtered;
};

const ensurePermissions = (permissions: string[] = []): string[] => {
  return Array.from(
    new Set([
      ...permissions,
      'INTERNET',
      'ACCESS_NETWORK_STATE',
      'com.google.android.gms.permission.AD_ID',
    ])
  );
};

const config: ExpoConfig = {
  ...baseConfig,
  plugins: ensurePlugin(baseConfig.plugins),
  android: {
    ...baseConfig.android,
    permissions: ensurePermissions(baseConfig.android?.permissions),
  },
};

export default config;
