// cache รายการกิจกรรมล่าสุด เพื่อเปิดดูได้ตอนไม่มีเน็ต
// เก็บเวลาอัปเดตไว้ด้วย เพราะต้องบอกผู้ใช้ว่ากำลังดูข้อมูลเก่าแค่ไหน

import type { Activity } from '@/types/models';
import { isActivity } from '@/services/validators';

import { readJson, writeJson } from './kv';

const CACHE_KEY = 'nktoday/activities-cache/v1';

export type ActivitiesCache = { activities: Activity[]; updatedAt: string };

const isCache = (v: unknown): v is ActivitiesCache =>
  typeof v === 'object' &&
  v !== null &&
  typeof (v as ActivitiesCache).updatedAt === 'string' &&
  Array.isArray((v as ActivitiesCache).activities) &&
  (v as ActivitiesCache).activities.every(isActivity);

export function loadActivitiesCache(): Promise<ActivitiesCache | null> {
  return readJson<ActivitiesCache | null>(CACHE_KEY, (v): v is ActivitiesCache | null => v === null || isCache(v), null);
}

export function saveActivitiesCache(activities: Activity[]): Promise<void> {
  return writeJson(CACHE_KEY, { activities, updatedAt: new Date().toISOString() });
}
