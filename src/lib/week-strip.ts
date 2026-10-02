// แถบ 7 วันของกิจกรรมที่ลงทะเบียนไว้ (ฟังก์ชันล้วน)

import type { Activity } from '@/types/models';

export type WeekDay = { key: string; date: Date; isToday: boolean };

const pad = (n: number) => String(n).padStart(2, '0');

/** คีย์วันตามเวลาในเครื่อง รูปแบบ YYYY-MM-DD */
export const dayKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** 7 วันนับจากวันนี้ */
export function weekDays(now = new Date(), days = 7): WeekDay[] {
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    return { key: dayKey(date), date, isToday: i === 0 };
  });
}

/** จำนวนกิจกรรมต่อวัน (นับวันเริ่มกิจกรรม) */
export function countByDay(activities: Activity[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const a of activities) {
    const key = dayKey(new Date(a.startsAt));
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}
