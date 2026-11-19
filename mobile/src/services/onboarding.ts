import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const KEY = 'sonic-ledger.onboarding.v1';
export async function hasCompletedOnboarding(): Promise<boolean> {
  if (Platform.OS === 'web') return globalThis.localStorage.getItem(KEY) === 'completed';
  return (await SecureStore.getItemAsync(KEY)) === 'completed';
}
export async function completeOnboarding(): Promise<void> {
  if (Platform.OS === 'web') globalThis.localStorage.setItem(KEY, 'completed');
  else await SecureStore.setItemAsync(KEY, 'completed');
}
