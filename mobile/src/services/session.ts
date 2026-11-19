import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
let memory = '';
const KEY = 'sonic.auth.token';
export async function getToken() { return memory || (Platform.OS === 'web' ? '' : await SecureStore.getItemAsync(KEY)) || ''; }
export async function saveToken(token: string, remember: boolean) {
 if (Platform.OS !== 'web') { if (remember) await SecureStore.setItemAsync(KEY, token); else await SecureStore.deleteItemAsync(KEY); }
 memory = token;
}
export async function clearToken() { if (Platform.OS !== 'web') await SecureStore.deleteItemAsync(KEY); memory = ''; }
