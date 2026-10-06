// กล่องแจ้งเตือน: ที่เดียวที่แอปถาม server ว่า "มีอะไรใหม่สำหรับฉันไหม"
// server เป็นคนตัดสินว่าใครควรรู้เรื่องอะไร (เช่น ผลตรวจหลักฐาน, กิจกรรมถูกยกเลิก)
// แอปแค่ poll ของตัวเองเป็นระยะแล้วเด้งแจ้งเตือนในเครื่อง (ตอนเปิดแอป) · ปิดแอปแล้ว server ส่ง push ให้ (services/push.ts)

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';

import { isUnread, latestCreatedAt, mergeInbox, unreadCount } from '@/lib/inbox';
import { registerForPush, type PushResult } from '@/services/push';
import { ensureNotificationPermission, presentInboxItem } from '@/services/reminders';
import * as inboxApi from '@/services/inbox-api';
import { isInboxItem } from '@/services/validators';
import { INBOX_KEY } from '@/storage/keys';
import { readJson, writeJson } from '@/storage/kv';
import type { InboxItem } from '@/types/models';

import { useAuthenticatedSession } from './session-context';

/** ถี่พอให้ "อีกฝั่งกด → อีกเครื่องเด้ง" ภายในไม่กี่วินาที และ poll เฉพาะตอนแอปเปิดอยู่ */
const POLL_MS = 8000;

/** readUntil = เวลาที่กด "อ่านทั้งหมด" ล่าสุด · readIds = รายการที่แตะดูแล้วทีละอัน */
type Stored = { userId: string; items: InboxItem[]; since: string; readUntil: string | null; readIds?: string[] };
const isStored = (v: unknown): v is Stored | null =>
  v === null ||
  (typeof v === 'object' &&
    typeof (v as Stored).userId === 'string' &&
    typeof (v as Stored).since === 'string' &&
    Array.isArray((v as Stored).items) &&
    (v as Stored).items.every(isInboxItem));

type InboxValue = {
  items: InboxItem[];
  unread: number;
  /** แจ้งเตือนล่าสุดที่เพิ่งมา (ใช้แสดงแถบในแอปบนเว็บ ซึ่งไม่มีแจ้งเตือนของระบบ) */
  latest: InboxItem | null;
  dismissLatest: () => void;
  /** ฟังเมื่อมีแจ้งเตือนใหม่ ให้ส่วนอื่นโหลดข้อมูลใหม่ตาม (เช่น รายการเรื่องแจ้ง) คืนฟังก์ชันเลิกฟัง */
  subscribe: (listener: (fresh: InboxItem[]) => void) => () => void;
  markAllRead: () => void;
  /** แตะดูรายการนี้แล้ว (ตัวเลขบนแท็บลดลง 1) */
  markRead: (id: string) => void;
  isUnread: (item: InboxItem) => boolean;
  refresh: () => Promise<void>;
  /** เครื่องนี้รับ push ได้ไหม (เด้งแม้ปิดแอป) · 'checking' = กำลังตรวจ */
  push: PushResult | 'checking';
  /** ขอสิทธิ์แจ้งเตือน (จากการกดปุ่ม) แล้วลงทะเบียน push */
  enablePush: () => Promise<void>;
};

const EMPTY: InboxValue = {
  items: [],
  unread: 0,
  latest: null,
  dismissLatest: () => undefined,
  subscribe: () => () => undefined,
  markAllRead: () => undefined,
  markRead: () => undefined,
  isUnread: () => false,
  refresh: async () => undefined,
  push: 'unavailable',
  enablePush: async () => undefined,
};

const InboxContext = createContext<InboxValue>(EMPTY);

export function InboxProvider({ children }: { children: ReactNode }) {
  const session = useAuthenticatedSession();
  if (!session) return <InboxContext.Provider value={EMPTY}>{children}</InboxContext.Provider>;
  // เปลี่ยนผู้ใช้ → state ใหม่ทั้งหมด
  return (
    <UserInbox key={session.user.id} token={session.token} userId={session.user.id}>
      {children}
    </UserInbox>
  );
}

function UserInbox({ token, userId, children }: { token: string; userId: string; children: ReactNode }) {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [readUntil, setReadUntil] = useState<string | null>(null);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [latest, setLatest] = useState<InboxItem | null>(null);
  const [push, setPush] = useState<PushResult | 'checking'>('checking');
  const listeners = useRef(new Set<(fresh: InboxItem[]) => void>());
  const pushRef = useRef(push);
  useEffect(() => {
    pushRef.current = push;
  }, [push]);

  // login แล้ว → ลงทะเบียน push ถ้าเคยอนุญาตแจ้งเตือนแล้ว (ไม่เด้งขอสิทธิ์เอง)
  useEffect(() => {
    registerForPush(token).then(setPush);
  }, [token]);

  const enablePush = useCallback(async () => {
    await ensureNotificationPermission();
    setPush(await registerForPush(token));
  }, [token]);
  // state ที่ตัวจับเวลาต้องอ่านค่าล่าสุด เก็บใน ref (ไม่ต้องเริ่มตัวจับเวลาใหม่ทุกครั้งที่เปลี่ยน)
  const stored = useRef<Stored | null>(null);
  const running = useRef(false);

  const save = useCallback((next: Stored) => {
    stored.current = next;
    writeJson(INBOX_KEY, next).catch(() => undefined);
  }, []);

  const check = useCallback(async () => {
    // มือถือ: poll เฉพาะตอนแอปเปิดอยู่ (ประหยัดแบต) · เว็บ: poll ต่อแม้แท็บอยู่ด้านหลัง
    // (เปิดหลายบัญชีในหลายแท็บบนเครื่องเดียว แท็บที่ไม่ได้ดูอยู่ต้องยังได้แจ้งเตือน)
    // Android ที่ไม่มี push ('local'): poll ต่อตอนอยู่เบื้องหลัง เพื่อเด้งแจ้งเตือนตอนผู้ใช้ไปใช้แอปอื่น
    const background = Platform.OS === 'web' || pushRef.current === 'local';
    if (running.current || (!background && AppState.currentState !== 'active')) return;
    running.current = true;
    try {
      const current = stored.current;
      // ครั้งแรกของผู้ใช้นี้ในเครื่อง: ดึงของเก่ามาแสดงในกล่อง แต่ไม่เด้งย้อนหลังทีละหลายอัน
      const firstRun = !current;
      const incoming = await inboxApi.getInbox(token, current?.since ?? '');
      const { items: merged, fresh } = mergeInbox(current?.items ?? [], incoming);
      // ครั้งแรก (เช่น เพิ่งเข้าสู่ระบบ/สลับบัญชี) ของเก่าก็นับเป็นยังไม่อ่าน จนกว่าจะแตะดูหรือกด "อ่านทั้งหมด"
      const known = new Set(merged.map((i) => i.id));
      const next: Stored = {
        userId,
        items: merged,
        since: latestCreatedAt(merged, current?.since ?? new Date(0).toISOString()),
        readUntil: current?.readUntil ?? null,
        readIds: (current?.readIds ?? []).filter((id) => known.has(id)),
      };
      save(next);
      setItems(merged);
      setReadUntil(next.readUntil);
      setReadIds(next.readIds ?? []);
      if (!firstRun && fresh.length > 0) {
        for (const item of fresh) await presentInboxItem(item).catch(() => undefined);
        setLatest(fresh[fresh.length - 1]);
        for (const listener of listeners.current) listener(fresh);
      }
    } catch {
      // ออฟไลน์หรือ server ปิด → ลองใหม่รอบหน้า
    } finally {
      running.current = false;
    }
  }, [save, token, userId]);

  useEffect(() => {
    let stopped = false;
    readJson(INBOX_KEY, isStored, null)
      .then((value) => {
        if (stopped) return;
        // ของผู้ใช้คนอื่นในเครื่องเดียวกัน → ไม่ใช้
        if (value && value.userId === userId) {
          stored.current = value;
          setItems(value.items);
          setReadUntil(value.readUntil);
          setReadIds(value.readIds ?? []);
        }
      })
      .finally(() => {
        if (!stopped) check();
      });
    const timer = setInterval(check, POLL_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => {
      stopped = true;
      clearInterval(timer);
      sub.remove();
    };
  }, [check, userId]);

  const markAllRead = useCallback(() => {
    const current = stored.current;
    if (!current) return;
    const until = latestCreatedAt(current.items, current.readUntil ?? new Date(0).toISOString());
    save({ ...current, readUntil: until, readIds: [] });
    setReadUntil(until);
    setReadIds([]);
  }, [save]);

  const markRead = useCallback(
    (id: string) => {
      const current = stored.current;
      if (!current || current.readIds?.includes(id)) return;
      const ids = [...(current.readIds ?? []), id];
      save({ ...current, readIds: ids });
      setReadIds(ids);
    },
    [save],
  );

  const subscribe = useCallback((listener: (fresh: InboxItem[]) => void) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  const value: InboxValue = {
    items,
    unread: unreadCount(items, readUntil, readIds),
    latest,
    dismissLatest: () => setLatest(null),
    subscribe,
    markAllRead,
    markRead,
    isUnread: (item) => isUnread(item, readUntil, readIds),
    refresh: check,
    push,
    enablePush,
  };
  return <InboxContext.Provider value={value}>{children}</InboxContext.Provider>;
}

export function useInbox(): InboxValue {
  return useContext(InboxContext);
}
