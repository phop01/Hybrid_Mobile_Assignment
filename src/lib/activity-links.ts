// ข้อความแชร์กิจกรรม (ฟังก์ชันล้วน ทดสอบได้)

import { formatDateRange } from '@/lib/format';
import type { Activity } from '@/types/models';

/** ข้อความที่ส่งเข้ากลุ่มแชต: ชื่อ เวลา สถานที่ และลิงก์เปิดหน้ากิจกรรมในแอป */
export function shareMessage(activity: Activity, link: string): string {
  return [
    `${activity.title}`,
    `🗓 ${formatDateRange(activity.startsAt, activity.endsAt)}`,
    `📍 ${activity.location.name}`,
    `ได้ ${activity.hours} ชั่วโมงกิจกรรม · KKUNK Today`,
    link,
  ].join('\n');
}
