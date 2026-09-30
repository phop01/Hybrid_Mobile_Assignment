// การแจ้งเตือนในเครื่อง (local notification) ใช้ได้ใน Expo Go ทุกเครื่อง
// มี 3 แบบ และทุกแบบเกิดจากเหตุการณ์จริง ไม่มีปุ่มทดสอบ:
// 1) เตือนก่อนกิจกรรมตามเวลาที่ผู้ใช้เลือก  2) เตือนก่อนเวลานัดซ่อม (จากเวลาในข้อมูล)
// 3) เรื่องใหม่ในกล่องแจ้งเตือน (อีกฝั่งทำอะไรบางอย่าง → server ใส่กล่อง → แอป poll แล้วเด้ง)
//    ถ้าเครื่องรับ push ได้ (services/push.ts) server ส่ง push แทน เด้งได้แม้ปิดแอป

import { Platform } from 'react-native';

import { formatLead } from '@/lib/check-in-rules';
import { Notifications } from '@/services/notifications-module';
import { isPushActive } from '@/services/push';
import { readJson, removeKeys, writeJson } from '@/storage/kv';
import type { Activity, InboxItem, InboxKind, Ticket } from '@/types/models';

export const supportsNotifications = Notifications !== null;

// แจ้งเตือนของเบราว์เซอร์มีเฉพาะบนเว็บ (ดู reminders.web.ts) มือถือใช้แจ้งเตือนของระบบอยู่แล้ว
export type WebNotificationStatus = 'granted' | 'denied' | 'default' | 'unsupported';
export function webNotificationStatus(): WebNotificationStatus {
  return 'unsupported';
}
export async function enableWebNotifications(): Promise<WebNotificationStatus> {
  return 'unsupported';
}

const CHANNEL_ID = 'nktoday-alerts';
const MAP_KEY = 'nktoday/reminder-ids/v2';

export type NotificationData =
  | { type: 'checkin'; registrationId: string }
  | { type: 'inbox'; kind: InboxKind; targetId: string };

// แอปเปิดอยู่ก็ต้องแสดง banner ไม่งั้นผู้ใช้จะไม่เห็นแจ้งเตือนเลย
Notifications?.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** registrationId → แจ้งเตือนที่ตั้งไว้ (เก็บเวลาไว้แสดงบนจอ และ id ไว้ยกเลิก) */
export type ScheduledReminder = { notificationId: string; at: string };
type ReminderMap = Record<string, ScheduledReminder>;
const isMap = (v: unknown): v is ReminderMap => typeof v === 'object' && v !== null && !Array.isArray(v);

export function loadReminderMap(): Promise<ReminderMap> {
  return readJson(MAP_KEY, isMap, {});
}

/** Android ต้องมี channel ก่อนแสดงแจ้งเตือนทุกครั้ง (รวมถึงแจ้งเตือนที่ผู้ใช้ไม่ได้กดตั้งเอง) */
async function ensureChannel(): Promise<void> {
  if (!Notifications || Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'แจ้งเตือน NK Today',
    importance: Notifications.AndroidImportance.HIGH,
  });
}

/**
 * ขอสิทธิ์ตอนผู้ใช้กด "ตั้งเตือน" เท่านั้น
 * Android ต้องสร้าง channel ก่อนขอสิทธิ์ ไม่งั้นหน้าต่างขอสิทธิ์จะไม่ขึ้น
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (!Notifications) return false;
  await ensureChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

/**
 * ตั้งเตือนกิจกรรม ณ เวลา date: ผู้ใช้เลือก "ก่อนงานเริ่ม X" (คำนวณด้วย reminderTime) หรือ "นับถอยหลังจากตอนนี้"
 * แตะแจ้งเตือนแล้วไปหน้าเช็กอิน
 */
export async function scheduleCheckInReminder(registrationId: string, activity: Activity, date: Date): Promise<ScheduledReminder> {
  if (!Notifications) throw new Error('notifications-unavailable');
  if (date.getTime() <= Date.now()) throw new Error('reminder-time-has-passed');
  const granted = await ensureNotificationPermission();
  if (!granted) throw new Error('notification-permission-denied');

  await cancelReminder(registrationId);
  const data: NotificationData = { type: 'checkin', registrationId };
  // บอกเวลาที่เหลือจริงตามที่ผู้ใช้ตั้ง เช่น "อีก 2 ชม. 30 นาที ถึงเวลากิจกรรม" · เตือนระหว่างงาน = ชวนไปเช็กอิน
  const leadMinutes = Math.round((new Date(activity.startsAt).getTime() - date.getTime()) / 60000);
  const title =
    leadMinutes > 0 ? `อีก ${formatLead(leadMinutes)} ถึงเวลากิจกรรม: ${activity.title}` : `กิจกรรมเริ่มแล้ว ส่งหลักฐานการเข้าร่วม: ${activity.title}`;
  const notificationId = await Notifications.scheduleNotificationAsync({
    content: { title, body: `ที่ ${activity.location.name} · แตะเพื่อดูรายละเอียดและเช็กอิน`, data },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: CHANNEL_ID },
  });
  const reminder = { notificationId, at: date.toISOString() };
  const map = await loadReminderMap();
  await writeJson(MAP_KEY, { ...map, [registrationId]: reminder });
  return reminder;
}

export async function cancelReminder(registrationId: string): Promise<void> {
  const map = await loadReminderMap();
  const reminder = map[registrationId];
  if (!reminder) return;
  await Notifications?.cancelScheduledNotificationAsync(reminder.notificationId).catch(() => undefined);
  const { [registrationId]: _removed, ...rest } = map;
  await writeJson(MAP_KEY, rest);
}

/** แสดงแจ้งเตือนทันที ถ้าผู้ใช้เคยอนุญาตแล้ว (ไม่ขอสิทธิ์เองเพราะผู้ใช้ไม่ได้กดอะไร) */
async function presentNow(content: { title: string; body: string; data: NotificationData }): Promise<void> {
  if (!Notifications) return;
  const current = await Notifications.getPermissionsAsync();
  if (!current.granted) return;
  await ensureChannel();
  await Notifications.scheduleNotificationAsync({
    content,
    trigger: Platform.OS === 'android' ? { channelId: CHANNEL_ID } : null,
  });
}

/**
 * เด้งแจ้งเตือนจากกล่องแจ้งเตือน (server เป็นคนตัดสินว่าใครควรรู้เรื่องอะไร เช่น
 * มีคนรับเรื่องแจ้งซ่อม, หลักฐานผ่าน, ประกาศจากเจ้าหน้าที่)
 * payload เก็บแค่ประเภทกับ ID หน้าปลายทางโหลดข้อมูลล่าสุดเอง
 */
export async function presentInboxItem(item: InboxItem): Promise<void> {
  // server ส่ง push มาแล้ว (เด้งเองทั้งตอนเปิด/ปิดแอป) ไม่ต้องเด้งซ้ำจากการ poll
  if (isPushActive()) return;
  await presentNow({ title: item.title, body: item.body, data: { type: 'inbox', kind: item.kind, targetId: item.targetId } });
}

// ---------- เตือนก่อนเวลานัดซ่อม (ตั้งจากเวลาในข้อมูล ไม่มีปุ่มทดสอบ) ----------

const APPOINTMENT_KEY = 'nktoday/appointment-reminders/v1';
/** เตือนก่อนเวลานัด 1 ชั่วโมง: ผู้แจ้งมีเวลาไปเปิดห้อง/รอช่าง */
const APPOINTMENT_LEAD_MS = 60 * 60 * 1000;

type AppointmentMap = Record<string, ScheduledReminder>;

/**
 * ให้ตรงกับเวลานัดล่าสุดของเรื่อง: ยังไม่ตั้ง → ตั้ง, เวลานัดเปลี่ยน → ตั้งใหม่, เวลาผ่านไปแล้ว → ไม่ตั้ง
 * ไม่ขอสิทธิ์เอง (ผู้ใช้ไม่ได้กดอะไร) ถ้ายังไม่เคยอนุญาตก็ข้ามไป
 */
export async function syncAppointmentReminders(tickets: Ticket[]): Promise<void> {
  if (!Notifications) return;
  const current = await Notifications.getPermissionsAsync();
  if (!current.granted) return;
  const map = await readJson(APPOINTMENT_KEY, isMap, {} as AppointmentMap);
  const next: AppointmentMap = {};
  const wanted = new Map<string, { ticket: Ticket; at: Date }>();
  for (const t of tickets) {
    if (t.status !== 'accepted' || !t.appointmentAt) continue;
    const at = new Date(Date.parse(t.appointmentAt) - APPOINTMENT_LEAD_MS);
    if (at.getTime() > Date.now()) wanted.set(t.id, { ticket: t, at });
  }
  // ยกเลิกอันที่ไม่ต้องการแล้วหรือเวลาเปลี่ยน
  for (const [id, reminder] of Object.entries(map)) {
    const want = wanted.get(id);
    if (want && want.at.toISOString() === reminder.at) {
      next[id] = reminder;
      wanted.delete(id);
    } else {
      await Notifications.cancelScheduledNotificationAsync(reminder.notificationId).catch(() => undefined);
    }
  }
  await ensureChannel();
  for (const [id, { ticket, at }] of wanted) {
    const data: NotificationData = { type: 'inbox', kind: 'ticket', targetId: id };
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: { title: 'อีก 1 ชั่วโมงถึงเวลานัดซ่อม', body: `${ticket.title} · ${ticket.location.name}`, data },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL_ID },
    });
    next[id] = { notificationId, at: at.toISOString() };
  }
  await writeJson(APPOINTMENT_KEY, next);
}

export async function clearAllReminders(): Promise<void> {
  await Notifications?.cancelAllScheduledNotificationsAsync().catch(() => undefined);
  await removeKeys([MAP_KEY, APPOINTMENT_KEY]);
}
