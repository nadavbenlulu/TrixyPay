import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const apiBaseUrl = (
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api'
).replace(/\/+$/, '');
const tokenKey = 'trixpay_access_token';

export async function apiRequest(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (Platform.OS !== 'web') {
    headers['X-Client-Platform'] = 'native';
    const token = await SecureStore.getItemAsync(tokenKey);
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  let response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      headers,
      credentials: 'include',
    });
  } catch {
    const error = new Error(
      'לא ניתן להגיע לשרת. בדקו שהוא פועל ואת כתובת ה־API בהגדרות.',
    );
    error.status = 0;
    throw error;
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.message || 'הבקשה נכשלה.');
    error.status = response.status;
    throw error;
  }
  return body;
}

export async function saveAccessToken(token) {
  if (Platform.OS !== 'web' && token) {
    await SecureStore.setItemAsync(tokenKey, token);
  }
}

export async function clearAccessToken() {
  if (Platform.OS !== 'web') {
    await SecureStore.deleteItemAsync(tokenKey);
  }
}

export async function hasAccessToken() {
  return Platform.OS === 'web' || Boolean(await SecureStore.getItemAsync(tokenKey));
}
