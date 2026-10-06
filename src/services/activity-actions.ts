// แชร์กิจกรรม (สัปดาห์ 11: Platform APIs + Deep Linking)

import * as Linking from 'expo-linking';
import { Share } from 'react-native';

import { shareMessage } from '@/lib/activity-links';
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
