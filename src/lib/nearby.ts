import { distanceMeters, walkingMinutes, type Coordinates } from '@/lib/geo';
import { isEnded } from '@/lib/filter-activities';
import type { Activity } from '@/types/models';

export type NearbyActivity = { activity: Activity; meters: number; walkMinutes: number };

/** กิจกรรมที่ยังไม่จบ เรียงตามระยะจากจุดที่อยู่ (ใกล้สุดก่อน) พร้อมเวลาเดินโดยประมาณ */
export function nearestActivities(activities: Activity[], from: Coordinates, limit = 3, now = Date.now()): NearbyActivity[] {
  return activities
    .filter((a) => !isEnded(a, now))
    .map((activity) => {
      const meters = distanceMeters(from, activity.location);
      return { activity, meters, walkMinutes: walkingMinutes(meters) };
    })
    .sort((a, b) => a.meters - b.meters)
    .slice(0, limit);
}
