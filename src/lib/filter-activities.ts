import type { Activity, Category } from '@/types/models';

export type CategoryFilter = Category | 'all';

/**
 * กรองกิจกรรมตามคำค้นและประเภท
 * เรียกตอน render แทนการเก็บผลลัพธ์ไว้ใน state อีกชุด
 * ข้อมูลจึงไม่มีทางไม่ตรงกับรายการต้นฉบับ
 */
export function filterActivities(activities: Activity[], query: string, category: CategoryFilter): Activity[] {
  const q = query.trim().toLowerCase();
  return activities.filter((activity) => {
    if (category !== 'all' && activity.category !== category) return false;
    if (!q) return true;
    return (
      activity.title.toLowerCase().includes(q) ||
      activity.location.name.toLowerCase().includes(q) ||
      activity.description.toLowerCase().includes(q)
    );
  });
}

export function isEnded(activity: Activity, now = Date.now()): boolean {
  return new Date(activity.endsAt).getTime() < now;
}

export function seatsLeft(activity: Activity): number {
  return Math.max(0, activity.capacity - activity.registeredCount);
}

/** เรียงให้กิจกรรมที่ยังไม่จบขึ้นก่อน เพราะเป็นสิ่งที่ผู้ใช้ยังลงทะเบียนได้ */
export function sortForBrowsing(activities: Activity[], now = Date.now()): Activity[] {
  return [...activities].sort((a, b) => {
    const endedDiff = Number(isEnded(a, now)) - Number(isEnded(b, now));
    return endedDiff !== 0 ? endedDiff : a.startsAt.localeCompare(b.startsAt);
  });
}
