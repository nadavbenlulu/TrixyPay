import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';

const apiBaseUrl = (
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api'
).replace(/\/+$/, '');
const tokenKey = 'trixpay_access_token';
const biometricLoginKey = 'trixpay_biometric_login_enabled';

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
    await Promise.all([
      SecureStore.deleteItemAsync(tokenKey),
      SecureStore.deleteItemAsync(biometricLoginKey),
    ]);
  }
}

export async function hasAccessToken() {
  return Platform.OS === 'web' || Boolean(await SecureStore.getItemAsync(tokenKey));
}

export async function isBiometricLoginEnabled() {
  return (
    Platform.OS !== 'web' &&
    (await SecureStore.getItemAsync(biometricLoginKey)) === 'true'
  );
}

export async function disableBiometricLogin() {
  if (Platform.OS !== 'web') {
    await SecureStore.deleteItemAsync(biometricLoginKey);
  }
}

export async function enableBiometricLogin() {
  if (Platform.OS === 'web') {
    return { enabled: false, message: 'יש להגדיר Passkey בדפדפן.' };
  }

  const [hasHardware, isEnrolled, authenticationTypes] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);
  if (!hasHardware || !isEnrolled || authenticationTypes.length === 0) {
    return {
      enabled: false,
      message: 'לא נמצאה במכשיר ביומטריה מוגדרת. יש להגדיר Face ID או טביעת אצבע במכשיר ולנסות שוב.',
    };
  }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'אישור הפעלת התחברות ביומטרית ל־TrixPay',
    cancelLabel: 'ביטול',
    disableDeviceFallback: true,
  });
  if (!result.success) {
    return {
      enabled: false,
      cancelled: result.error === 'user_cancel',
      message: 'לא ניתן לאמת את הזהות. אפשר לנסות שוב או להמשיך עם שם משתמש וסיסמה.',
    };
  }

  if (!(await SecureStore.getItemAsync(tokenKey))) {
    return {
      enabled: false,
      message: 'יש להתחבר עם שם משתמש וסיסמה לפני הפעלת ההתחברות הביומטרית.',
    };
  }

  await SecureStore.setItemAsync(biometricLoginKey, 'true');
  return { enabled: true };
}

export async function authenticateBiometricLogin() {
  if (!(await isBiometricLoginEnabled())) {
    throw new Error('ההתחברות הביומטרית לא הופעלה במכשיר הזה.');
  }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'התחברות ל־TrixPay',
    cancelLabel: 'ביטול',
    disableDeviceFallback: true,
  });
  if (!result.success) {
    if (result.error === 'user_cancel') {
      return false;
    }
    throw new Error('לא ניתן לאמת את הזהות. אפשר לנסות שוב או להתחבר עם שם משתמש וסיסמה.');
  }

  if (!(await SecureStore.getItemAsync(tokenKey))) {
    await clearAccessToken();
    throw new Error('לא נמצאה התחברות שמורה. יש להתחבר עם שם משתמש וסיסמה.');
  }
  return true;
}
