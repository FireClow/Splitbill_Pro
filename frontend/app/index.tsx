import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View } from 'react-native';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    // Small delay to ensure Stack is mounted before navigation
    const timer = setTimeout(() => {
      router.replace('/(tabs)/home');
    }, 100);

    return () => clearTimeout(timer);
  }, [router]);

  // Return empty view while redirecting
  return <View style={{ flex: 1, backgroundColor: '#09090B' }} />;
}
