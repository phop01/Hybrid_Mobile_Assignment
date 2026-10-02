// แชร์กิจกรรม และเพิ่มลงปฏิทิน (สัปดาห์ 11: Platform APIs + Deep Linking)

import * as Linking from 'expo-linking';
import { Platform, Share } from 'react-native';

import { googleCalendarUrl, shareMessage } from '@/lib/activity-links';
import type { Activity } from '@/types/models';

export type ActionResult = 'done' | 'copied' | 'cancelled' | 'failed';

/** ลิงก์เปิดหน้ากิจกรรมในแอป (nktoday://… ในแอป, ที่อยู่เว็บบนเว็บ) */
export const activityLink = (id: string) => Linking.createURL(`/activities/${encodeURIComponent(id)}`);

/**
 * เปิดหน้าต่างแชร์ของเครื่อง · ถ้าเบราว์เซอร์ไม่มีหน้าต่างแชร์ ใช้คัดลอกข้อความแทน (ผลลัพธ์ 'copied')
 */
export async function shareActivity(activity: Activity): Promise<ActionResult> {
  const message = shareMessage(activity, activityLink(activity.id));
  try {
    const result = await Share.share({ message, title: activity.title });
    return result.action === Share.dismissedAction ? 'cancelled' : 'done';
  } catch {
    try {
      await navigator.clipboard.writeText(message);
      return 'copied';
    } catch {
      return 'failed';
    }
  }
}

/**
 * เพิ่มกิจกรรมลงปฏิทินของเครื่อง
 * มือถือ: เปิดฟอร์มเพิ่มกิจกรรมของระบบให้ผู้ใช้กดบันทึกเอง (ไม่ต้องให้แอปขอสิทธิ์อ่าน/เขียนปฏิทินทั้งหมด)
 * เว็บ: เปิดหน้า Google Calendar
 */
export async function addToCalendar(activity: Activity): Promise<ActionResult> {
  if (Platform.OS === 'web') {
    window.open(googleCalendarUrl(activity), '_blank', 'noopener');
    return 'done';
  }
  try {
    // ใช้ API แบบ legacy เพราะทำงานได้ใน Expo Go (API ใหม่ต้องใช้ development build)
    const Calendar = await import('expo-calendar/legacy');
    const result = await Calendar.createEventInCalendarAsync({
      title: activity.title,
      startDate: new Date(activity.startsAt),
      endDate: new Date(activity.endsAt),
      location: activity.location.name,
      notes: `${activity.description}\n\nได้ ${activity.hours} ชั่วโมงกิจกรรม · KKUNK Today`,
      alarms: [{ relativeOffset: -60 }],
    });
    return result.action === 'canceled' ? 'cancelled' : 'done';
  } catch {
    return 'failed';
  }
}
