import { useEffect, useState } from 'react';

import { ApiError, isAbortError } from '@/services/api-client';
import * as api from '@/services/campus-api';
import { useActivities } from '@/state/activities-context';
import type { Activity } from '@/types/models';

export type ActivityState =
  | { status: 'loading' }
  | { status: 'ready'; activity: Activity; stale: boolean }
  | { status: 'not_found' }
  | { status: 'error'; message: string };

/**
 * โหลดกิจกรรมล่าสุดจาก server ด้วย ID
 * รับแค่ ID ผ่าน route ไม่ส่งทั้ง object เพราะที่นั่งคงเหลือเปลี่ยนตลอด
 * ระหว่างโหลดหรือออฟไลน์ → ใช้ข้อมูลจากรายการที่มีอยู่ (stale = true)
 */
export function useActivity(id: string | undefined, reloadKey = 0): ActivityState {
  const { getById, upsert } = useActivities();
  // ผลลัพธ์ผูกกับ ID ที่โหลด ถ้า ID เปลี่ยน ผลเก่าจะไม่ถูกใช้
  const [result, setResult] = useState<{ id: string; state: ActivityState } | null>(null);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    api
      .getActivity(id, controller.signal)
      .then((activity) => {
        upsert(activity);
        setResult({ id, state: { status: 'ready', activity, stale: false } });
      })
      .catch((error: unknown) => {
        if (isAbortError(error)) return;
        if (error instanceof ApiError && error.status === 404) return setResult({ id, state: { status: 'not_found' } });
        const cached = getById(id);
        setResult({
          id,
          state: cached
            ? { status: 'ready', activity: cached, stale: true }
            : { status: 'error', message: error instanceof Error ? error.message : 'โหลดกิจกรรมไม่สำเร็จ' },
        });
      });
    // ออกจากหน้าก่อนโหลดเสร็จ → ยกเลิก request
    return () => controller.abort();
  }, [id, reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!id) return { status: 'not_found' };
  if (result && result.id === id) {
    // ข้อมูลในรายการกลางใหม่กว่า (เช่น เพิ่งโหลดรายการใหม่) → ใช้ตัวนั้น
    const latest = getById(id);
    if (result.state.status === 'ready' && latest) return { ...result.state, activity: latest };
    // เปิดแอปมาที่หน้านี้ตรง ๆ ตอนออฟไลน์: request ล้มก่อนโหลด cache เสร็จ → พอ cache มาแล้วใช้ตัวนั้น
    if (result.state.status === 'error' && latest) return { status: 'ready', activity: latest, stale: true };
    return result.state;
  }
  const cached = getById(id);
  return cached ? { status: 'ready', activity: cached, stale: true } : { status: 'loading' };
}

/** ค่า param จาก URL อาจเป็น array หรือไม่มีเลย ต้องตรวจก่อนใช้ */
export function firstParam(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return v && v.length <= 100 ? v : undefined;
}
