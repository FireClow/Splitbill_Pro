import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, ApiError, setToken } from '../utils/api';
import { logger } from '../utils/logger';

export default function RootLayout() {
  useEffect(() => {
    // Auto-authenticate on app launch with device ID
    const autoAuth = async (): Promise<void> => {
      try {
        let deviceId = await AsyncStorage.getItem('device_id');
        
        if (!deviceId) {
          // Generate unique device ID on first launch
          const timestamp = Date.now();
          const random = Math.random().toString(36).slice(2, 10);
          deviceId = `device_${timestamp}_${random}`;
          await AsyncStorage.setItem('device_id', deviceId);
          logger.log('Auth', 'Generated new device ID');
        }

        // Exchange device ID for session token
        const result = await api.exchangeSession(deviceId);
        
        if (result.session_token) {
          await setToken(result.session_token);
          logger.log('Auth', 'Session token acquired successfully');
        } else {
          logger.warn('Auth', 'No session token in response');
        }
      } catch (error) {
        if (error instanceof ApiError) {
          logger.warn('Auth', `Auto-auth failed [status: ${error.status}]: ${error.message}`);
        } else {
          logger.warn('Auth', 'Auto-auth failed', error);
        }
        // App continues to work without auth (graceful degradation)
      }
    };

    autoAuth();
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#09090B' },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen 
          name="create-bill" 
          options={{
            presentation: 'modal',
          }} 
        />
        <Stack.Screen 
          name="bill/[id]" 
        />
      </Stack>
    </>
  );
}
