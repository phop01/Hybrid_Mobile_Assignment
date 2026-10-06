import type { Activity, Category, Registration } from '@/types/models';

export type AttendanceSummary = {
  total: number;
  byCategory: Record<Category, number>;
  pendingReview: number;
  /** ชั่วโมงกิจกรรมรวม (นับเฉพาะที่เข้าร่วมสำเร็จ) */
  hours: number;
  hoursByCategory: Record<Category, number>;
  /** ชั่วโมงที่รอผู้จัดตรวจ (ยังไม่นับ) */
  pendingHours: number;
};

const emptyByCategory = (): Record<Category, number> => ({ academic: 0, volunteer: 0, sport: 0, culture: 0 });

/**
 * นับกิจกรรมและชั่วโมงที่เข้าร่วม (ไม่มีเป้าหมายตายตัว แสดงเป็นชั่วโมงสะสมทั้งหมด)
 * นับเฉพาะ checked_in เท่านั้น: ลงทะเบียนแล้วไม่ไป หรือหลักฐานยังรอตรวจ ต้องไม่ถูกนับ
 */
export function summarizeAttendance(registrations: Registration[], activities: Activity[]): AttendanceSummary {
  const byId = new Map(activities.map((a) => [a.id, a]));
  const summary: AttendanceSummary = {
    total: 0,
    byCategory: emptyByCategory(),
    pendingReview: 0,
    hours: 0,
    hoursByCategory: emptyByCategory(),
    pendingHours: 0,
  };
  for (const registration of registrations) {
    const activity = byId.get(registration.activityId);
    if (registration.status === 'pending_review') {
      summary.pendingReview += 1;
      summary.pendingHours += activity?.hours ?? 0;
    }
    if (registration.status !== 'checked_in') continue;
    summary.total += 1;
    if (!activity) continue;
    summary.byCategory[activity.category] += 1;
    summary.hours += activity.hours;
    summary.hoursByCategory[activity.category] += activity.hours;
  }
  return summary;
}
