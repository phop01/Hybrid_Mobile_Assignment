// เว็บไม่มี local notification ของ expo-notifications → เตือนกิจกรรมด้วยตัวจับเวลาในหน้า + Notification API ของเบราว์เซอร์
// (ต้องเปิดแท็บค้างไว้จนถึงเวลาเตือน ปิดแท็บ/รีเฟรชแล้วเตือนที่ตั้งไว้หายไป)
// แจ้งเตือนจากกล่องแจ้งเตือน (อีกฝั่งทำอะไร) ใช้ Notification API ของเบราว์เซอร์แทน → เด้งมุมจอคอมแม้ดูแท็บอื่นอยู่
// ร่วมกับแถบในแอป (components/inbox-toast.tsx)

import { router } from 'expo-router';

import { formatLead } from '@/lib/check-in-rules';
import { targetFor } from '@/lib/inbox';
import type { Activity, InboxItem, InboxKind } from '@/types/models';

export const supportsNotifications = webNotificationStatus() !== 'unsupported';

export type WebNotificationStatus = 'granted' | 'denied' | 'default' | 'unsupported';

export function webNotificationStatus(): WebNotificationStatus {
  if (typeof window === 'undefined' || !('Notification' in window) || !window.isSecureContext) return 'unsupported';
  return Notification.permission;
}

/** ขอสิทธิ์แจ้งเตือนของเบราว์เซอร์ (ต้องเรียกจากการกดปุ่มของผู้ใช้) */
export async function enableWebNotifications(): Promise<WebNotificationStatus> {
  if (webNotificationStatus() === 'unsupported') return 'unsupported';
  return Notification.requestPermission();
}

export type NotificationData =
  | { type: 'checkin'; registrationId: string }
  | { type: 'inbox'; kind: InboxKind; targetId: string };
export type ScheduledReminder = { notificationId: string; at: string };

const MAX_TIMER_MS = 2 ** 31 - 1;

// registrationId → เตือนที่ตั้งไว้ (อยู่ในหน่วยความจำของแท็บนี้เท่านั้น)
const timers = new Map<string, { reminder: ScheduledReminder; timer: ReturnType<typeof setTimeout> }>();

export async function loadReminderMap(): Promise<Record<string, ScheduledReminder>> {
  return Object.fromEntries([...timers].map(([id, t]) => [id, t.reminder]));
}
/** ขอสิทธิ์จากการกดปุ่ม "ตั้งแจ้งเตือน" ของผู้ใช้ */
export async function ensureNotificationPermission(): Promise<boolean> {
  return (await enableWebNotifications()) === 'granted';
}
export async function scheduleCheckInReminder(registrationId: string, activity: Activity, date: Date): Promise<ScheduledReminder> {
  if (date.getTime() <= Date.now()) throw new Error('reminder-time-has-passed');
  if (!(await ensureNotificationPermission())) throw new Error('notification-permission-denied');
  await cancelReminder(registrationId);
  const leadMinutes = Math.round((new Date(activity.startsAt).getTime() - date.getTime()) / 60000);
  const title =
    leadMinutes > 0 ? `อีก ${formatLead(leadMinutes)} ถึงเวลากิจกรรม: ${activity.title}` : `ถึงเวลาเช็กอิน: ${activity.title}`;
  const reminder: ScheduledReminder = { notificationId: `web-${registrationId}`, at: date.toISOString() };
  const fire = () => {
    timers.delete(registrationId);
    if (webNotificationStatus() !== 'granted') return;
    const notification = new Notification(title, { body: `ที่ ${activity.location.name} · แตะเพื่อเปิดหน้าการลงทะเบียน`, tag: reminder.notificationId, icon: '/favicon.ico' });
    notification.onclick = () => {
      window.focus();
      notification.close();
      router.push({ pathname: '/registrations/[id]', params: { id: registrationId } });
    };
  };
  // setTimeout รับได้ไม่เกิน ~24.8 วัน (เกินแล้วเบราว์เซอร์ยิงทันที) → รอเป็นช่วง ๆ แล้วตั้งใหม่จนถึงเวลา
  const arm = () => {
    const remaining = date.getTime() - Date.now();
    const timer = setTimeout(remaining > MAX_TIMER_MS ? arm : fire, Math.min(remaining, MAX_TIMER_MS));
    timers.set(registrationId, { reminder, timer });
  };
  arm();
  return reminder;
}
export async function cancelReminder(registrationId: string): Promise<void> {
  const t = timers.get(registrationId);
  if (t) clearTimeout(t.timer);
  timers.delete(registrationId);
}
/** เด้งแจ้งเตือนของระบบบนคอม (ถ้าผู้ใช้อนุญาตแล้ว) แตะแล้วกลับมาที่แท็บนี้และเปิดหน้าที่เกี่ยวข้อง */
export async function presentInboxItem(item: InboxItem): Promise<void> {
  if (webNotificationStatus() !== 'granted') return;
  const notification = new Notification(item.title, { body: item.body, tag: item.id, icon: '/favicon.ico' });
  notification.onclick = () => {
    window.focus();
    notification.close();
    const target = targetFor(item.kind, item.targetId);
    if (target) router.push(target as never);
  };
}
export async function clearAllReminders(): Promise<void> {
  for (const id of [...timers.keys()]) await cancelReminder(id);
}
