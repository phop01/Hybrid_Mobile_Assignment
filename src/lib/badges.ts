// เหรียญความสำเร็จในโปรไฟล์ คำนวณจากสรุปการเข้าร่วม (ฟังก์ชันล้วน)
// ไม่มีเป้าชั่วโมงตายตัว เหรียญจึงนับจากจำนวนกิจกรรม ชั่วโมงสะสม และความหลากหลายของหมวด

import type { IconName } from '@/components/ui';
import type { AttendanceSummary } from '@/lib/attendance';
import { CATEGORY_ORDER } from '@/lib/categories';

export type Badge = { id: string; label: string; hint: string; icon: IconName; earned: boolean };

export function computeBadges(summary: AttendanceSummary): Badge[] {
  const categories = CATEGORY_ORDER.filter((c) => summary.byCategory[c] > 0).length;
  return [
    { id: 'first', label: 'ก้าวแรก', hint: 'เข้าร่วมกิจกรรมครั้งแรก', icon: 'footsteps', earned: summary.total >= 1 },
    { id: 'volunteer', label: 'ใจอาสา', hint: 'เข้าร่วมกิจกรรมจิตอาสา', icon: 'heart', earned: summary.byCategory.volunteer >= 1 },
    { id: 'h10', label: '10 ชั่วโมง', hint: 'สะสมครบ 10 ชั่วโมง', icon: 'time', earned: summary.hours >= 10 },
    { id: 'regular', label: 'ขาประจำ', hint: 'เข้าร่วมครบ 5 กิจกรรม', icon: 'repeat', earned: summary.total >= 5 },
    { id: 'all-round', label: 'ครบทุกด้าน', hint: 'เข้าร่วมครบทั้ง 4 หมวด', icon: 'sparkles', earned: categories === CATEGORY_ORDER.length },
    { id: 'h30', label: '30 ชั่วโมง', hint: 'สะสมครบ 30 ชั่วโมง', icon: 'trophy', earned: summary.hours >= 30 },
  ];
}
