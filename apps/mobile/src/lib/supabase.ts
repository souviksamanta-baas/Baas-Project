import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('Missing Expo Supabase public environment variables');
}

const fallbackStorage = new Map<string, string>();

const authStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return fallbackStorage.get(key) ?? null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    fallbackStorage.set(key, value);

    try {
      await AsyncStorage.setItem(key, value);
    } catch {
      // Expo Go may not include the native AsyncStorage module. The in-memory
      // fallback keeps simulator sessions working for Phase 2 verification.
    }
  },
  async removeItem(key: string): Promise<void> {
    fallbackStorage.delete(key);

    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // See setItem fallback note above.
    }
  },
};

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
