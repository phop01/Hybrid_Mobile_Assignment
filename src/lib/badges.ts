// เหรียญความสำเร็จในโปรไฟล์ คำนวณจากสรุปการเข้าร่วม (ฟังก์ชันล้วน)

import type { IconName } from '@/components/ui';
import type { AttendanceSummary } from '@/lib/attendance';
import { CATEGORY_ORDER } from '@/lib/categories';

export type Badge = { id: string; label: string; hint: string; icon: IconName; earned: boolean };

export function computeBadges(summary: AttendanceSummary): Badge[] {
  const everyCategory = CATEGORY_ORDER.every((c) => summary.byCategory[c] > 0);
  return [
    { id: 'first', label: 'ก้าวแรก', hint: 'เข้าร่วมกิจกรรมครั้งแรก', icon: 'footsteps', earned: summary.total >= 1 },
    { id: 'volunteer', label: 'ใจอาสา', hint: 'เข้าร่วมกิจกรรมจิตอาสา', icon: 'heart', earned: summary.byCategory.volunteer >= 1 },
    { id: 'all-round', label: 'ครบทุกด้าน', hint: 'เข้าร่วมครบทุกหมวดกิจกรรม', icon: 'sparkles', earned: everyCategory },
    { id: 'p25', label: 'ถึง 25%', hint: 'ชั่วโมงสะสมถึง 25% ของเป้าหมาย', icon: 'trending-up', earned: summary.progress >= 0.25 },
    { id: 'p50', label: 'ครึ่งทาง', hint: 'ชั่วโมงสะสมถึง 50% ของเป้าหมาย', icon: 'flag', earned: summary.progress >= 0.5 },
    { id: 'p100', label: 'ครบเป้าหมาย', hint: 'ชั่วโมงสะสมครบเป้าหมาย', icon: 'trophy', earned: summary.progress >= 1 },
  ];
}
