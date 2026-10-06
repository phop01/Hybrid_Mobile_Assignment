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

/** จบแล้ว หรือเจ้าหน้าที่ยกเลิกแล้ว (ทั้งสองแบบไม่ต้องแสดงเป็นกิจกรรมที่กำลังจะมาถึง) */
export function isEnded(activity: Activity, now = Date.now()): boolean {
  return Boolean(activity.cancelledAt) || new Date(activity.endsAt).getTime() < now;
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

/** ใหม่ล่าสุดก่อน (ตามเวลาที่โพสต์) · ข้อมูลเก่าที่ไม่มีเวลาโพสต์ไปอยู่ท้าย เรียงตามวันจัดที่ใกล้ก่อน */
export function newestFirst(activities: Activity[]): Activity[] {
  return [...activities].sort((a, b) => {
    if (a.createdAt && b.createdAt) return b.createdAt.localeCompare(a.createdAt);
    if (a.createdAt || b.createdAt) return a.createdAt ? -1 : 1;
    return a.startsAt.localeCompare(b.startsAt);
  });
}

export type AvailabilityFilter = 'all' | 'open' | 'week';
export type SortMode = 'date' | 'seats' | 'newest';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type BrowseOptions = {
  query: string;
  category: CategoryFilter;
  /** open = ยังไม่จบและมีที่นั่งว่าง · week = ยังไม่จบและเริ่มภายใน 7 วัน */
  availability: AvailabilityFilter;
  /** date = ใกล้ถึงก่อน · seats = ที่นั่งว่างมากก่อน · newest = เพิ่งโพสต์ก่อน */
  sort: SortMode;
};

/** ค้นหา + กรองประเภท + กรองความพร้อม + เรียง ในที่เดียว (ฟังก์ชันล้วน ทดสอบได้) */
export function browseActivities(activities: Activity[], options: BrowseOptions, now = Date.now()): Activity[] {
  let list = filterActivities(activities, options.query, options.category);
  if (options.availability === 'open') list = list.filter((a) => !isEnded(a, now) && seatsLeft(a) > 0);
  if (options.availability === 'week') {
    list = list.filter((a) => !isEnded(a, now) && new Date(a.startsAt).getTime() <= now + WEEK_MS);
  }
  const byDate = sortForBrowsing(list, now);
  if (options.sort === 'date') return byDate;
  if (options.sort === 'newest') {
    // เพิ่งโพสต์ก่อน กิจกรรมที่จบแล้วอยู่ท้ายเสมอ
    return newestFirst(byDate).sort((a, b) => Number(isEnded(a, now)) - Number(isEnded(b, now)));
  }
  // ที่นั่งว่างมากก่อน (เท่ากันเรียงตามวัน) กิจกรรมที่จบแล้วอยู่ท้ายเสมอ
  return byDate.sort((a, b) => {
    const endedDiff = Number(isEnded(a, now)) - Number(isEnded(b, now));
    return endedDiff !== 0 ? endedDiff : seatsLeft(b) - seatsLeft(a);
  });
}
