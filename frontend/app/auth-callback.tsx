import { useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../utils/colors';
import { logger } from '../utils/logger';

export default function AuthCallback() {
  const { login } = useAuth();
  const router = useRouter();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processAuth = async () => {
      try {
        let sessionId = '';
        if (Platform.OS === 'web') {
          const globalWindow = globalThis as any;
          const hash = (globalWindow.window?.location?.hash) || '';
          const match = hash.match(/session_id=([^&]+)/);
          if (match) sessionId = match[1];
        }
        if (!sessionId) {
          router.replace('/login');
          return;
        }
        await login(sessionId);
        router.replace('/(tabs)/home');
      } catch (err) {
        logger.warn('AuthCallback', 'Auth callback failed', err);
        router.replace('/login');
      }
    };

    processAuth();
  }, [login, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator testID="auth-loading" size="large" color={Colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
