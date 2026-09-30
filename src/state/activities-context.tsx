import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { ApiError, isAbortError } from '@/services/api-client';
import * as api from '@/services/campus-api';
import { loadActivitiesCache, saveActivitiesCache } from '@/storage/activities-cache';
import type { Activity } from '@/types/models';

/**
 * สถานะของรายการกิจกรรม
 * แยก refreshing ออกจาก loading เพื่อให้ดึงลงรีเฟรชแล้วรายการเดิมไม่หายไประหว่างโหลด
 */
export type ActivitiesStatus = 'loading' | 'ready' | 'refreshing' | 'error';

type ActivitiesContextValue = {
  activities: Activity[];
  status: ActivitiesStatus;
  error: string | null;
  /** มีค่าเมื่อกำลังแสดงข้อมูลจาก cache เพราะติดต่อ server ไม่ได้ */
  offlineSince: string | null;
  refresh: () => Promise<void>;
  getById: (id: string) => Activity | undefined;
  upsert: (activity: Activity) => void;
};

const ActivitiesContext = createContext<ActivitiesContextValue | null>(null);

export function ActivitiesProvider({ children }: { children: ReactNode }) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [status, setStatus] = useState<ActivitiesStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [offlineSince, setOfflineSince] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const hasDataRef = useRef(false);

  const refresh = useCallback(async () => {
    // ยกเลิก request เก่า ผลเก่าที่มาช้าจะได้ไม่ทับผลใหม่
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setStatus(hasDataRef.current ? 'refreshing' : 'loading');

    try {
      const fresh = await api.getActivities(controller.signal);
      hasDataRef.current = true;
      setActivities(fresh);
      setOfflineSince(null);
      setError(null);
      setStatus('ready');
      saveActivitiesCache(fresh).catch(() => undefined);
    } catch (e) {
      if (isAbortError(e)) return;
      const message = e instanceof Error ? e.message : 'โหลดกิจกรรมไม่สำเร็จ';
      // offline-first: ติดต่อไม่ได้ → ใช้ cache ถ้ามี พร้อมบอกเวลาอัปเดตล่าสุด
      const cache = e instanceof ApiError && e.isNetwork ? await loadActivitiesCache() : null;
      if (cache && cache.activities.length > 0) {
        hasDataRef.current = true;
        setActivities(cache.activities);
        setOfflineSince(cache.updatedAt);
        setError(null);
        setStatus('ready');
      } else if (hasDataRef.current) {
        setError(message);
        setStatus('ready');
      } else {
        setError(message);
        setStatus('error');
      }
    }
  }, []);

  useEffect(() => {
    // แสดง cache ทันทีระหว่างรอ server เปิดแอปแล้วไม่เจอหน้าว่าง
    loadActivitiesCache().then((cache) => {
      if (cache && !hasDataRef.current) {
        hasDataRef.current = true;
        setActivities(cache.activities);
        setStatus('refreshing');
      }
    });
    refresh();
    return () => controllerRef.current?.abort();
  }, [refresh]);

  const value: ActivitiesContextValue = {
    activities,
    status,
    error,
    offlineSince,
    refresh,
    getById: (id) => activities.find((a) => a.id === id),
    upsert: (activity) =>
      setActivities((current) =>
        current.some((a) => a.id === activity.id)
          ? current.map((a) => (a.id === activity.id ? activity : a))
          : [...current, activity],
      ),
  };
  return <ActivitiesContext.Provider value={value}>{children}</ActivitiesContext.Provider>;
}

export function useActivities(): ActivitiesContextValue {
  const value = useContext(ActivitiesContext);
  if (!value) throw new Error('useActivities ต้องใช้ภายใน ActivitiesProvider');
  return value;
}
