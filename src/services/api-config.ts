import Constants from 'expo-constants';
import { Platform } from 'react-native';

const API_PORT = 3001;

/**
 * หาที่อยู่ของ API ให้อัตโนมัติ เพื่อให้ clone แล้ว `npm start` ใช้ได้ทันทีโดยไม่ต้องสร้าง .env
 * - ตั้ง EXPO_PUBLIC_API_URL ไว้ → ใช้ค่านั้น
 * - เว็บ → เครื่องเดียวกับที่เปิดหน้าเว็บ
 * - Expo Go → IP ของคอมพิวเตอร์ที่รัน Metro (อ่านจาก hostUri) เพราะ API รันบนเครื่องเดียวกัน
 */
export function resolveApiUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) return explicit.replace(/\/$/, '');

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:${API_PORT}`;
  }

  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(':')[0];
  if (host) return `http://${host}:${API_PORT}`;

  return `http://localhost:${API_PORT}`;
}

export const API_URL = resolveApiUrl();

/** รูปหลักฐานเก็บที่ server เป็น path สัมพัทธ์ ต้องต่อกับ API_URL ก่อนแสดง */
export function toAbsoluteUrl(path: string): string {
  return /^https?:\/\//.test(path) ? path : `${API_URL}${path}`;
}
