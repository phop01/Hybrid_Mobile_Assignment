// เว็บไม่รองรับ local notification ของ expo-notifications (ตั้งเตือนล่วงหน้าไม่ได้)
// คง API เดิมไว้ให้หน้าจอเรียกได้ แต่ supportsNotifications = false เพื่อซ่อนปุ่มตั้งเตือนกิจกรรม
// แจ้งเตือนจากกล่องแจ้งเตือน (อีกฝั่งทำอะไร) ใช้ Notification API ของเบราว์เซอร์แทน → เด้งมุมจอคอมแม้ดูแท็บอื่นอยู่
// ร่วมกับแถบในแอป (components/inbox-toast.tsx)

import { router } from 'expo-router';

import { targetFor } from '@/lib/inbox';
import type { Activity, InboxItem, InboxKind, Ticket } from '@/types/models';

export const supportsNotifications = false;

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

export const APPOINTMENT_LEAD_MS = 60 * 60 * 1000;

const unsupported = () => Promise.reject(new Error('notifications-unsupported-on-web'));

export async function loadReminderMap(): Promise<Record<string, ScheduledReminder>> {
  return {};
}
export async function ensureNotificationPermission(): Promise<boolean> {
  return false;
}
export function scheduleCheckInReminder(_registrationId: string, _activity: Activity, _date: Date): Promise<ScheduledReminder> {
  return unsupported();
}
export async function cancelReminder(_registrationId: string): Promise<void> {}
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
export async function syncAppointmentReminders(_tickets: Ticket[]): Promise<void> {}
export async function clearAllReminders(): Promise<void> {}
