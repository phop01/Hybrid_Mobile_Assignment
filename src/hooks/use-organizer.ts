// ข้อมูลฝั่งผู้จัดกิจกรรม (สัปดาห์ 12: แยกการดึงข้อมูลออกจากหน้าจอ)
// โหลดใหม่ทุกครั้งที่เปิดหน้า เพราะนักศึกษาส่งหลักฐานเข้ามาได้ตลอด ข้อมูลเก่าทำให้ผู้จัดพลาดรายการรอตรวจ

import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { isAbortError } from '@/services/api-client';
import * as api from '@/services/campus-api';
import { useAuthenticatedSession, useOrganizerSession } from '@/state/session-context';
import type { Announcement, OrganizerActivity, Registration } from '@/types/models';

const POLL_MS = 10000;

type Loadable<T> = { data: T; loading: boolean; error: string | null };

/** โหลดข้อมูลตอนเปิดหน้า + ทุก 10 วินาทีขณะหน้านั้นเปิดอยู่ */
function useLiveLoad<T>(initial: T, fetcher: ((signal: AbortSignal) => Promise<T>) | null) {
  const [state, setState] = useState<Loadable<T>>({ data: initial, loading: true, error: null });
  const controllerRef = useRef<AbortController | null>(null);

  const reload = useCallback(async () => {
    if (!fetcher) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState((s) => ({ ...s, loading: true }));
    try {
      const data = await fetcher(controller.signal);
      setState({ data, loading: false, error: null });
    } catch (e) {
      if (isAbortError(e)) return;
      setState((s) => ({ ...s, loading: false, error: e instanceof Error ? e.message : 'โหลดข้อมูลไม่สำเร็จ' }));
    }
  }, [fetcher]);

  useFocusEffect(
    useCallback(() => {
      const first = setTimeout(reload, 0);
      const timer = setInterval(reload, POLL_MS);
      return () => {
        clearTimeout(first);
        clearInterval(timer);
        controllerRef.current?.abort();
      };
    }, [reload]),
  );

  useEffect(() => () => controllerRef.current?.abort(), []);

  return { ...state, reload, setData: (data: T) => setState((s) => ({ ...s, data })) };
}

export function useOrganizerActivities() {
  const session = useOrganizerSession();
  const token = session?.token ?? null;
  const fetcher = useCallback(
    (signal: AbortSignal) => (token ? api.getOrganizerActivities(token, signal) : Promise.resolve([])),
    [token],
  );
  return useLiveLoad<OrganizerActivity[]>([], token ? fetcher : null);
}

export function useAttendees(activityId: string | undefined) {
  const session = useOrganizerSession();
  const token = session?.token ?? null;
  const fetcher = useCallback(
    (signal: AbortSignal) => (token && activityId ? api.getAttendees(token, activityId, signal) : Promise.resolve([])),
    [token, activityId],
  );
  const live = useLiveLoad<Registration[]>([], token && activityId ? fetcher : null);

  /** ผลตรวจหลักฐาน: อัปเดตรายการทันที ไม่ต้องรอโหลดรอบถัดไป */
  const review = useCallback(
    async (registrationId: string, decision: { approve: true } | { approve: false; note: string }) => {
      if (!token) throw new Error('กรุณาเข้าสู่ระบบ');
      const updated = await api.reviewRegistration(token, registrationId, decision);
      live.setData(live.data.map((r) => (r.id === updated.id ? updated : r)));
      return updated;
    },
    [token, live],
  );

  /** ไม่รับการลงทะเบียนของคนนี้ */
  const reject = useCallback(
    async (registrationId: string, note: string) => {
      if (!token) throw new Error('กรุณาเข้าสู่ระบบ');
      const updated = await api.rejectRegistration(token, registrationId, note);
      live.setData(live.data.map((r) => (r.id === updated.id ? updated : r)));
      return updated;
    },
    [token, live],
  );

  /** ยกเลิกทั้งกิจกรรม แล้วโหลดรายชื่อใหม่ (ทุกคนเปลี่ยนเป็นยกเลิก) */
  const cancelActivity = useCallback(
    async (note: string) => {
      if (!token || !activityId) throw new Error('กรุณาเข้าสู่ระบบ');
      const updated = await api.cancelActivity(token, activityId, note);
      await live.reload();
      return updated;
    },
    [token, activityId, live],
  );

  return { ...live, review, reject, cancelActivity };
}

/**
 * ประกาศของกิจกรรมหนึ่ง: ผู้จัดส่งได้ (send) ทุกคนที่ login แล้วอ่านได้
 * นักศึกษาเห็นในหน้ากิจกรรม และแอปเด้งแจ้งเตือนให้ผ่าน useAnnouncementAlerts
 */
export function useActivityAnnouncements(activityId: string | undefined) {
  const session = useAuthenticatedSession();
  const token = session?.token ?? null;
  const fetcher = useCallback(
    (signal: AbortSignal) => (token && activityId ? api.getActivityAnnouncements(token, activityId, signal) : Promise.resolve([])),
    [token, activityId],
  );
  const live = useLiveLoad<Announcement[]>([], token && activityId ? fetcher : null);
  const { data, setData } = live;

  const send = useCallback(
    async (message: string) => {
      if (!token || !activityId) throw new Error('กรุณาเข้าสู่ระบบ');
      const created = await api.sendAnnouncement(token, activityId, message);
      setData([created, ...data]);
      return created;
    },
    [activityId, data, setData, token],
  );

  return { ...live, send };
}
