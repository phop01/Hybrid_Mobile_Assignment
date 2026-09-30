import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { ApiError } from '@/services/api-client';
import * as api from '@/services/campus-api';
import { cancelReminder } from '@/services/reminders';
import {
  enqueueCheckIn,
  listQueuedCheckIns,
  loadRegistrationsCache,
  removeQueuedCheckIn,
  saveRegistrationsCache,
} from '@/storage/offline-db';
import type { PendingCheckIn, Registration, RegistrationForm } from '@/types/models';

import { useAuthenticatedSession } from './session-context';

export type CheckInOutcome = { kind: 'sent'; registration: Registration } | { kind: 'queued' };

type MyRegistrationsValue = {
  registrations: Registration[];
  loading: boolean;
  /** มีค่าเมื่อแสดงข้อมูลจากเครื่องเพราะติดต่อ server ไม่ได้ */
  offlineSince: string | null;
  error: string | null;
  queuedIds: string[];
  refresh: () => Promise<void>;
  findById: (id: string) => Registration | undefined;
  findActiveForActivity: (activityId: string) => Registration | undefined;
  register: (activityId: string, form: RegistrationForm, idempotencyKey: string) => Promise<Registration>;
  cancel: (id: string) => Promise<void>;
  checkIn: (item: PendingCheckIn) => Promise<CheckInOutcome>;
  /** แนบรูปหลักฐานเพิ่มหลังส่งแล้ว (ต้องออนไลน์) */
  addPhoto: (registrationId: string, photoBase64: string) => Promise<void>;
};

const MyRegistrationsContext = createContext<MyRegistrationsValue | null>(null);

const POLL_PENDING_MS = 5000;
const RETRY_QUEUE_MS = 15000;

/** เปลี่ยนผู้ใช้ (login/logout) → สร้าง state ใหม่ทั้งหมด ข้อมูลของคนก่อนไม่ค้าง */
export function MyRegistrationsProvider({ children }: { children: ReactNode }) {
  const session = useAuthenticatedSession();
  return <UserRegistrationsProvider key={session?.user.id ?? 'anonymous'}>{children}</UserRegistrationsProvider>;
}

function UserRegistrationsProvider({ children }: { children: ReactNode }) {
  const session = useAuthenticatedSession();
  const token = session?.token ?? null;
  const userId = session?.user.id ?? null;

  const [registrations, setRegistrations] = useState<Registration[]>([]);
  // เริ่มเป็น true เมื่อ login อยู่ เพราะจะโหลดทันที
  const [loading, setLoading] = useState(Boolean(token));
  const [offlineSince, setOfflineSince] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [queuedIds, setQueuedIds] = useState<string[]>([]);
  // รายการล่าสุดเสมอ: ผลของ request ที่เพิ่งเสร็จต้องต่อจากข้อมูลปัจจุบัน ไม่ใช่ค่าตอนกดปุ่ม
  // (ระหว่างรอ poll/refresh อาจอัปเดตรายการไปแล้ว)
  const registrationsRef = useRef<Registration[]>([]);

  const show = useCallback((list: Registration[]) => {
    registrationsRef.current = list;
    setRegistrations(list);
  }, []);

  // ผลตรวจหลักฐาน/ประกาศจากผู้จัด server ส่งเข้ากล่องแจ้งเตือนแล้ว (state/inbox-context) ที่นี่แค่เก็บข้อมูล
  const apply = useCallback(
    (list: Registration[]) => {
      show(list);
      if (userId) saveRegistrationsCache(userId, list).catch(() => undefined);
    },
    [show, userId],
  );

  /** แทนรายการเดียวด้วยผลจาก server */
  const replaceOne = useCallback(
    (updated: Registration) => apply(registrationsRef.current.map((r) => (r.id === updated.id ? updated : r))),
    [apply],
  );

  /** ส่งเช็กอินที่ค้างในคิวออฟไลน์ */
  const flushQueue = useCallback(async () => {
    if (!token) return;
    const queue = await listQueuedCheckIns();
    for (const item of queue) {
      try {
        await api.submitCheckIn(token, item.registrationId, item);
        await removeQueuedCheckIn(item.registrationId);
      } catch (e) {
        if (e instanceof ApiError && e.isRetryable) break; // ยังออฟไลน์/server ล่มชั่วคราว ลองใหม่รอบหน้า
        // server ปฏิเสธ (เช่น ถูกยกเลิกไปแล้ว) → เอาออกจากคิว ผู้ใช้จะเห็นว่ายังไม่ได้เช็กอินและทำใหม่ได้
        await removeQueuedCheckIn(item.registrationId);
        setError(e instanceof Error ? `เช็กอินที่รอส่งถูกปฏิเสธ: ${e.message}` : 'เช็กอินที่รอส่งถูกปฏิเสธ');
      }
    }
    setQueuedIds((await listQueuedCheckIns()).map((q) => q.registrationId));
  }, [token]);

  const refresh = useCallback(async () => {
    if (!token || !userId) return;
    setLoading(true);
    try {
      await flushQueue();
      const list = await api.getMyRegistrations(token);
      apply(list);
      setOfflineSince(null);
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && e.isNetwork) {
        const cache = await loadRegistrationsCache(userId);
        if (cache) {
          show(cache.registrations);
          setOfflineSince(cache.updatedAt);
        }
        setError(cache ? null : e.message);
      } else {
        setError(e instanceof Error ? e.message : 'โหลดการลงทะเบียนไม่สำเร็จ');
      }
    } finally {
      setLoading(false);
    }
  }, [apply, flushQueue, show, token, userId]);

  // เข้าระบบแล้ว → แสดงข้อมูลในเครื่องก่อน แล้วค่อยโหลดจาก server
  useEffect(() => {
    if (!token || !userId) return;
    loadRegistrationsCache(userId)
      .then((cache) => {
        if (cache) show(cache.registrations);
      })
      .catch(() => undefined)
      .finally(() => refresh());
    listQueuedCheckIns().then((q) => setQueuedIds(q.map((i) => i.registrationId)));
  }, [token, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // กลับเข้าแอป → รีเฟรช (อาจเพิ่งกลับมามีเน็ต หรือผู้จัดเพิ่งตรวจหลักฐาน)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  // มีหลักฐานรอตรวจ → เช็กสถานะเป็นระยะ (แอปนี้ไม่มี push server)
  const hasPending = registrations.some((r) => r.status === 'pending_review');
  useEffect(() => {
    if (!hasPending) return;
    const timer = setInterval(refresh, POLL_PENDING_MS);
    return () => clearInterval(timer);
  }, [hasPending, refresh]);

  // มีเช็กอินค้างในคิว → ลองส่งใหม่เป็นระยะ
  useEffect(() => {
    if (queuedIds.length === 0) return;
    const timer = setInterval(refresh, RETRY_QUEUE_MS);
    return () => clearInterval(timer);
  }, [queuedIds.length, refresh]);

  const register = useCallback(
    async (activityId: string, form: RegistrationForm, idempotencyKey: string) => {
      if (!token) throw new Error('กรุณาเข้าสู่ระบบ');
      const registration = await api.registerForActivity(token, activityId, form, idempotencyKey);
      apply([registration, ...registrationsRef.current.filter((r) => r.id !== registration.id)]);
      return registration;
    },
    [apply, token],
  );

  const cancel = useCallback(
    async (id: string) => {
      if (!token) throw new Error('กรุณาเข้าสู่ระบบ');
      const updated = await api.cancelRegistration(token, id);
      await cancelReminder(id); // ยกเลิกแล้วต้องไม่เตือนอีก
      replaceOne(updated);
    },
    [replaceOne, token],
  );

  const checkIn = useCallback(
    async (item: PendingCheckIn): Promise<CheckInOutcome> => {
      if (!token) throw new Error('กรุณาเข้าสู่ระบบ');
      try {
        const updated = await api.submitCheckIn(token, item.registrationId, item);
        await cancelReminder(item.registrationId);
        replaceOne(updated);
        return { kind: 'sent', registration: updated };
      } catch (e) {
        if (!(e instanceof ApiError && e.isNetwork)) throw e;
        // ห้องจัดงานไม่มีสัญญาณ → เก็บไว้ในเครื่อง ส่งให้อัตโนมัติเมื่อเน็ตกลับมา
        await enqueueCheckIn(item);
        setQueuedIds((ids) => [...new Set([...ids, item.registrationId])]);
        return { kind: 'queued' };
      }
    },
    [replaceOne, token],
  );

  const addPhoto = useCallback(
    async (registrationId: string, photoBase64: string) => {
      if (!token) throw new Error('กรุณาเข้าสู่ระบบ');
      const updated = await api.addEvidencePhoto(token, registrationId, photoBase64);
      replaceOne(updated);
    },
    [replaceOne, token],
  );

  const value: MyRegistrationsValue = {
    registrations,
    loading,
    offlineSince,
    error,
    queuedIds,
    refresh,
    findById: (id) => registrations.find((r) => r.id === id),
    findActiveForActivity: (activityId) =>
      registrations.find((r) => r.activityId === activityId && r.status !== 'cancelled'),
    register,
    cancel,
    checkIn,
    addPhoto,
  };
  return <MyRegistrationsContext.Provider value={value}>{children}</MyRegistrationsContext.Provider>;
}

export function useMyRegistrations(): MyRegistrationsValue {
  const value = useContext(MyRegistrationsContext);
  if (!value) throw new Error('useMyRegistrations ต้องใช้ภายใน MyRegistrationsProvider');
  return value;
}
