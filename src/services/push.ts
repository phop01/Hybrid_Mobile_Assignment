// Push notification (สัปดาห์ 11): ให้แจ้งเตือนเด้งแม้ปิดแอปหรือล็อกจอ
// แอปขอ Expo push token แล้วส่งให้ server → server ส่งผ่าน Expo Push Service ทุกครั้งที่ notify()
// ใช้ได้ใน Expo Go บน iPhone · Android ใน Expo Go (SDK 53+) ไม่รองรับ remote push
// → แอป poll ต่อตอนอยู่เบื้องหลังแล้วเด้งแจ้งเตือนในเครื่องแทน ('local': เด้งตอนไปใช้แอปอื่นได้ แต่ถ้าปัดแอปทิ้งจะไม่เด้ง)
// ต้องมี projectId ของ EAS ใน app.json (npx eas-cli init) ไม่มี → ข้ามไปเงียบ ๆ

import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { apiRequest } from './api-client';
import { Notifications, remotePushSupported } from './notifications-module';

export type PushResult = 'active' | 'local' | 'no-permission' | 'unavailable';

let active = false;

/** push ทำงานอยู่ → server เป็นคนเด้งให้แล้ว แอปไม่ต้องสร้างแจ้งเตือนซ้ำจากการ poll */
export function isPushActive(): boolean {
  return active;
}

function projectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

/**
 * ลงทะเบียนเครื่องนี้รับ push ของบัญชีที่ login อยู่
 * ไม่ขอสิทธิ์เอง (ขอจากการกดปุ่มของผู้ใช้เท่านั้น) ถ้ายังไม่ได้สิทธิ์คืน 'no-permission'
 */
export async function registerForPush(sessionToken: string): Promise<PushResult> {
  if (Platform.OS === 'web' || !Notifications) return 'unavailable';
  const id = projectId();
  if (!remotePushSupported || !id) {
    // ไม่มี push → เด้งจากการ poll (Android poll ต่อตอนอยู่เบื้องหลังได้ · iPhone ระบบหยุดแอปทันทีที่ออก)
    if (Platform.OS !== 'android') return 'unavailable';
    const permission = await Notifications.getPermissionsAsync();
    return permission.granted ? 'local' : 'no-permission';
  }
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return 'no-permission';
  try {
    const { data: pushToken } = await Notifications.getExpoPushTokenAsync({ projectId: id });
    await apiRequest('/me/push-token', { method: 'POST', token: sessionToken, body: { token: pushToken } });
    active = true;
    return 'active';
  } catch {
    // Android ใน Expo Go / ไม่มีเน็ต / Expo ล่ม → ใช้ poll ตอนเปิดแอปแบบเดิม
    active = false;
    return 'unavailable';
  }
}

/** ออกจากระบบ: server ลบ token ของ session นี้เองตอน logout ฝั่งแอปแค่กลับไปใช้แจ้งเตือนจากการ poll */
export function forgetPush(): void {
  active = false;
}
