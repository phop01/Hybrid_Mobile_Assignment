// ข้อความแชร์กิจกรรมและลิงก์เพิ่มลงปฏิทิน (ฟังก์ชันล้วน ทดสอบได้)

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

// Google Calendar ต้องการเวลาเป็น UTC รูปแบบ YYYYMMDDTHHmmssZ
const gcalTime = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** ลิงก์ "เพิ่มลงปฏิทิน" ที่เปิดได้บนเว็บ (ไม่ต้องขอสิทธิ์) */
export function googleCalendarUrl(activity: Activity): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: activity.title,
    dates: `${gcalTime(activity.startsAt)}/${gcalTime(activity.endsAt)}`,
    location: activity.location.name,
    details: `${activity.description}\n\nได้ ${activity.hours} ชั่วโมงกิจกรรม · KKUNK Today`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
