// ประกาศทั่ววิทยาเขต (แหล่งข้อมูลเดียวของทั้งแอป)
// ออฟไลน์: แสดงข้อมูลในเครื่องพร้อมเวลาอัปเดตล่าสุด

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { ApiError } from '@/services/api-client';
import * as broadcastsApi from '@/services/broadcasts-api';
import { isBroadcast } from '@/services/validators';
import { BROADCASTS_CACHE_KEY } from '@/storage/keys';
import { readJson, writeJson } from '@/storage/kv';
import type { Broadcast, NewBroadcastInput } from '@/types/models';

import { useInbox } from './inbox-context';
import { useAuthenticatedSession } from './session-context';

type Cache = { userId: string; broadcasts: Broadcast[]; updatedAt: string };
const isCache = (v: unknown): v is Cache | null =>
  v === null ||
  (typeof v === 'object' &&
    typeof (v as Cache).userId === 'string' &&
    typeof (v as Cache).updatedAt === 'string' &&
    Array.isArray((v as Cache).broadcasts) &&
    (v as Cache).broadcasts.every(isBroadcast));

type BroadcastsValue = {
  broadcasts: Broadcast[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  offlineSince: string | null;
  refresh: () => Promise<void>;
  broadcast: (input: NewBroadcastInput) => Promise<Broadcast>;
  endBroadcast: (id: string) => Promise<void>;
};

const BroadcastsContext = createContext<BroadcastsValue | null>(null);

export function BroadcastsProvider({ children }: { children: ReactNode }) {
  const session = useAuthenticatedSession();
  return <UserBroadcasts key={session?.user.id ?? 'anonymous'}>{children}</UserBroadcasts>;
}

function UserBroadcasts({ children }: { children: ReactNode }) {
  const session = useAuthenticatedSession();
  const token = session?.token ?? null;
  const userId = session?.user.id ?? null;
  const { subscribe } = useInbox();

  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [status, setStatus] = useState<BroadcastsValue['status']>(token ? 'loading' : 'idle');
  const [error, setError] = useState<string | null>(null);
  const [offlineSince, setOfflineSince] = useState<string | null>(null);
  // ค่าล่าสุดเสมอ: ผลของ action ที่เพิ่งเสร็จต้องต่อจากข้อมูลปัจจุบัน ไม่ใช่ค่าตอนกดปุ่ม
  const broadcastsRef = useRef<Broadcast[]>([]);

  const show = useCallback((next: Broadcast[]) => {
    broadcastsRef.current = next;
    setBroadcasts(next);
  }, []);

  const apply = useCallback(
    (next: Broadcast[]) => {
      show(next);
      if (!userId) return;
      writeJson(BROADCASTS_CACHE_KEY, { userId, broadcasts: next, updatedAt: new Date().toISOString() }).catch(() => undefined);
    },
    [show, userId],
  );

  const refresh = useCallback(async () => {
    if (!token || !userId) return;
    try {
      apply(await broadcastsApi.getBroadcasts(token));
      setOfflineSince(null);
      setError(null);
      setStatus('ready');
    } catch (e) {
      if (e instanceof ApiError && e.isNetwork) {
        const cache = await readJson(BROADCASTS_CACHE_KEY, isCache, null);
        if (cache && cache.userId === userId) {
          show(cache.broadcasts);
          setOfflineSince(cache.updatedAt);
          setStatus('ready');
          return;
        }
      }
      setError(e instanceof Error ? e.message : 'โหลดข้อมูลไม่สำเร็จ');
      setStatus((s) => (s === 'ready' ? s : 'error'));
    }
  }, [apply, show, token, userId]);

  // เข้าระบบ → แสดงข้อมูลในเครื่องก่อน แล้วโหลดจาก server
  useEffect(() => {
    if (!token || !userId) return;
    readJson(BROADCASTS_CACHE_KEY, isCache, null)
      .then((cache) => {
        if (cache && cache.userId === userId) {
          show(cache.broadcasts);
          setStatus('ready');
        }
      })
      .finally(() => refresh());
  }, [token, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // มีแจ้งเตือนใหม่ (อีกฝั่งเพิ่งทำอะไรบางอย่าง) → โหลดใหม่ให้หน้าจอตรงกับแจ้งเตือน
  useEffect(() => subscribe(() => refresh()), [subscribe, refresh]);

  // กลับเข้าแอป → รีเฟรช
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const broadcast = useCallback(
    async (input: NewBroadcastInput) => {
      if (!token) throw new Error('กรุณาเข้าสู่ระบบ');
      const created = await broadcastsApi.createBroadcast(token, input);
      apply([created, ...broadcastsRef.current]);
      return created;
    },
    [apply, token],
  );

  const endBroadcast = useCallback(
    async (id: string) => {
      if (!token) throw new Error('กรุณาเข้าสู่ระบบ');
      await broadcastsApi.endBroadcast(token, id);
      apply(broadcastsRef.current.filter((b) => b.id !== id));
    },
    [apply, token],
  );

  const value: BroadcastsValue = { broadcasts, status, error, offlineSince, refresh, broadcast, endBroadcast };
  return <BroadcastsContext.Provider value={value}>{children}</BroadcastsContext.Provider>;
}

export function useBroadcasts(): BroadcastsValue {
  const value = useContext(BroadcastsContext);
  if (!value) throw new Error('useBroadcasts ต้องใช้ภายใน BroadcastsProvider');
  return value;
}
