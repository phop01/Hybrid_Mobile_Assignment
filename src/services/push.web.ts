// เว็บไม่มี Expo push token แจ้งเตือนบนคอมใช้ Notification API ของเบราว์เซอร์แทน (ดู reminders.web.ts)

export type PushResult = 'active' | 'local' | 'no-permission' | 'unavailable';

export async function registerForPush(_sessionToken: string): Promise<PushResult> {
  return 'unavailable';
}

export function forgetPush(): void {}
