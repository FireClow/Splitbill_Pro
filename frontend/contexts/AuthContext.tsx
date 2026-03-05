import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, setToken, removeToken } from '../utils/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface User {
  user_id: string;
  email: string;
  name: string;
  picture?: string;
  preferred_currency?: string; // User's preferred currency (default: USD)
  isPremium?: boolean; // Feature flag: Premium users don't see ads
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (sessionId: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
  checkAuth: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }
      const userData = await api.getMe();
      setUser(userData);
    } catch {
      setUser(null);
      await removeToken();
    } finally {
      setLoading(false);
    }
  }, []);

  const login = async (sessionId: string) => {
    const result = await api.exchangeSession(sessionId);
    if (result.session_token) {
      await setToken(result.session_token);
      // Create a default user object with premium flag
      setUser({
        user_id: result.user_id || sessionId,
        name: 'User',
        email: '',
        isPremium: false, // Default: user starts as free tier
      });
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {}
    await removeToken();
    setUser(null);
  };

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};
