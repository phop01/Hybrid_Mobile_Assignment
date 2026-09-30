// token เก็บใน SecureStore (Keychain บน iOS / Keystore บน Android)
// เหตุผล: token มีค่าเท่ากับรหัสผ่าน ห้ามเก็บใน AsyncStorage ที่อ่านได้ง่าย

import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'nktoday.session-token';

export function loadToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export function saveToken(token: string): Promise<void> {
  return SecureStore.setItemAsync(TOKEN_KEY, token);
}

export function clearToken(): Promise<void> {
  return SecureStore.deleteItemAsync(TOKEN_KEY);
}
