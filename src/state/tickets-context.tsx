// เรื่องแจ้งซ่อม + ประกาศ (แหล่งข้อมูลเดียวของทั้งแอป)
// ออฟไลน์: แสดงข้อมูลในเครื่องพร้อมเวลาอัปเดตล่าสุด และเรื่องที่กดส่งตอนไม่มีเน็ตเข้าคิว SQLite ส่งเองทีหลัง

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { newIdempotencyKey } from '@/lib/platform-actions';
import { ApiError } from '@/services/api-client';
import { syncAppointmentReminders } from '@/services/reminders';
import * as ticketsApi from '@/services/tickets-api';
import { isBroadcast, isTicket } from '@/services/validators';
import { TICKETS_CACHE_KEY } from '@/storage/keys';
import { readJson, writeJson } from '@/storage/kv';
import { enqueueTicket, listQueuedTickets, removeQueuedTicket } from '@/storage/offline-db';
import type { Broadcast, NewBroadcastInput, NewTicketInput, PendingTicket, Ticket } from '@/types/models';

import { useInbox } from './inbox-context';
import { useAuthenticatedSession } from './session-context';

const RETRY_QUEUE_MS = 15000;

type Cache = { userId: string; tickets: Ticket[]; broadcasts: Broadcast[]; updatedAt: string };
const isCache = (v: unknown): v is Cache | null =>
  v === null ||
  (typeof v === 'object' &&
    typeof (v as Cache).userId === 'string' &&
    typeof (v as Cache).updatedAt === 'string' &&
    Array.isArray((v as Cache).tickets) &&
    (v as Cache).tickets.every(isTicket) &&
    Array.isArray((v as Cache).broadcasts) &&
    (v as Cache).broadcasts.every(isBroadcast));

export type CreateOutcome = { kind: 'sent'; ticket: Ticket } | { kind: 'queued' };

type TicketsValue = {
  tickets: Ticket[];
  broadcasts: Broadcast[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  offlineSince: string | null;
  queued: PendingTicket[];
  refresh: () => Promise<void>;
  getById: (id: string) => Ticket | undefined;
  create: (input: NewTicketInput) => Promise<CreateOutcome>;
  act: (id: string, action: ticketsApi.TicketAction) => Promise<Ticket>;
  /** โหลดเรื่องเดียวจาก server (หน้ารายละเอียดที่เปิดจากแจ้งเตือน) */
  load: (id: string) => Promise<Ticket>;
  broadcast: (input: NewBroadcastInput) => Promise<Broadcast>;
  endBroadcast: (id: string) => Promise<void>;
};

const TicketsContext = createContext<TicketsValue | null>(null);

export function TicketsProvider({ children }: { children: ReactNode }) {
  const session = useAuthenticatedSession();
  return <UserTickets key={session?.user.id ?? 'anonymous'}>{children}</UserTickets>;
}

function UserTickets({ children }: { children: ReactNode }) {
  const session = useAuthenticatedSession();
  const token = session?.token ?? null;
  const userId = session?.user.id ?? null;
  const { subscribe } = useInbox();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [status, setStatus] = useState<TicketsValue['status']>(token ? 'loading' : 'idle');
  const [error, setError] = useState<string | null>(null);
  const [offlineSince, setOfflineSince] = useState<string | null>(null);
  const [queued, setQueued] = useState<PendingTicket[]>([]);
  // ค่าล่าสุดเสมอ: ผลของ action ที่เพิ่งเสร็จต้องต่อจากข้อมูลปัจจุบัน ไม่ใช่ค่าตอนกดปุ่ม
  const ticketsRef = useRef<Ticket[]>([]);
  const broadcastsRef = useRef<Broadcast[]>([]);

  const show = useCallback((nextTickets: Ticket[], nextBroadcasts: Broadcast[]) => {
    ticketsRef.current = nextTickets;
    broadcastsRef.current = nextBroadcasts;
    setTickets(nextTickets);
    setBroadcasts(nextBroadcasts);
  }, []);

  const apply = useCallback(
    (nextTickets: Ticket[], nextBroadcasts: Broadcast[]) => {
      show(nextTickets, nextBroadcasts);
      if (!userId) return;
      writeJson(TICKETS_CACHE_KEY, {
        userId,
        tickets: nextTickets,
        broadcasts: nextBroadcasts,
        updatedAt: new Date().toISOString(),
      }).catch(() => undefined);
      // เตือนก่อนนัดซ่อม: เฉพาะเรื่องที่ฉันแจ้ง/ติดตาม/เป็นคนไปซ่อม
      const mine = nextTickets.filter((t) => t.reporterId === userId || t.following || t.assigneeId === userId);
      syncAppointmentReminders(mine).catch(() => undefined);
    },
    [show, userId],
  );

  const replaceOne = useCallback(
    (ticket: Ticket) => {
      const exists = ticketsRef.current.some((t) => t.id === ticket.id);
      const next = exists ? ticketsRef.current.map((t) => (t.id === ticket.id ? ticket : t)) : [ticket, ...ticketsRef.current];
      apply(next, broadcastsRef.current);
    },
    [apply],
  );

  /** ส่งเรื่องที่ค้างในคิว (key เดิม server ไม่สร้างซ้ำ) */
  const flushQueue = useCallback(async () => {
    if (!token || !userId) return;
    for (const item of await listQueuedTickets(userId)) {
      try {
        await ticketsApi.createTicket(token, item.input, item.idempotencyKey);
        await removeQueuedTicket(item.idempotencyKey);
      } catch (e) {
        if (e instanceof ApiError && e.isRetryable) break; // ยังออฟไลน์/server ล่มชั่วคราว ลองใหม่รอบหน้า
        await removeQueuedTicket(item.idempotencyKey);
        setError(e instanceof Error ? `เรื่องที่รอส่งถูกปฏิเสธ: ${e.message}` : 'เรื่องที่รอส่งถูกปฏิเสธ');
      }
    }
    setQueued(await listQueuedTickets(userId));
  }, [token, userId]);

  const refresh = useCallback(async () => {
    if (!token || !userId) return;
    try {
      await flushQueue();
      const [nextTickets, nextBroadcasts] = await Promise.all([ticketsApi.getTickets(token), ticketsApi.getBroadcasts(token)]);
      apply(nextTickets, nextBroadcasts);
      setOfflineSince(null);
      setError(null);
      setStatus('ready');
    } catch (e) {
      if (e instanceof ApiError && e.isNetwork) {
        const cache = await readJson(TICKETS_CACHE_KEY, isCache, null);
        if (cache && cache.userId === userId) {
          show(cache.tickets, cache.broadcasts);
          setOfflineSince(cache.updatedAt);
          setStatus('ready');
          return;
        }
      }
      setError(e instanceof Error ? e.message : 'โหลดข้อมูลไม่สำเร็จ');
      setStatus((s) => (s === 'ready' ? s : 'error'));
    }
  }, [apply, flushQueue, show, token, userId]);

  // เข้าระบบ → แสดงข้อมูลในเครื่องก่อน แล้วโหลดจาก server
  useEffect(() => {
    if (!token || !userId) return;
    readJson(TICKETS_CACHE_KEY, isCache, null)
      .then((cache) => {
        if (cache && cache.userId === userId) {
          show(cache.tickets, cache.broadcasts);
          setStatus('ready');
        }
      })
      .finally(() => refresh());
    listQueuedTickets(userId).then(setQueued).catch(() => undefined);
  },[token, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // มีแจ้งเตือนใหม่ (อีกฝั่งเพิ่งทำอะไรบางอย่าง) → โหลดใหม่ให้หน้าจอตรงกับแจ้งเตือน
  useEffect(() => subscribe(() => refresh()), [subscribe, refresh]);

  // กลับเข้าแอป → รีเฟรช
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  useEffect(() => {
    if (queued.length === 0) return;
    const timer = setInterval(refresh, RETRY_QUEUE_MS);
    return () => clearInterval(timer);
  }, [queued.length, refresh]);

  const create = useCallback(
    async (input: NewTicketInput): Promise<CreateOutcome> => {
      if (!token || !userId) throw new Error('กรุณาเข้าสู่ระบบ');
      const idempotencyKey = newIdempotencyKey();
      try {
        const ticket = await ticketsApi.createTicket(token, input, idempotencyKey);
        replaceOne(ticket);
        return { kind: 'sent', ticket };
      } catch (e) {
        if (!(e instanceof ApiError && e.isNetwork)) throw e;
        // ในตึก/ห้องที่ไม่มีสัญญาณ → เก็บไว้ในเครื่อง ส่งให้อัตโนมัติเมื่อเน็ตกลับมา
        await enqueueTicket(userId, { idempotencyKey, input, createdAt: new Date().toISOString() });
        setQueued(await listQueuedTickets(userId));
        return { kind: 'queued' };
      }
    },
    [replaceOne, token, userId],
  );

  const act = useCallback(
    async (id: string, action: ticketsApi.TicketAction) => {
      if (!token) throw new Error('กรุณาเข้าสู่ระบบ');
      const ticket = await ticketsApi.runTicketAction(token, id, action);
      replaceOne(ticket);
      return ticket;
    },
    [replaceOne, token],
  );

  const load = useCallback(
    async (id: string) => {
      if (!token) throw new Error('กรุณาเข้าสู่ระบบ');
      const ticket = await ticketsApi.getTicket(token, id);
      replaceOne(ticket);
      return ticket;
    },
    [replaceOne, token],
  );

  const broadcast = useCallback(
    async (input: NewBroadcastInput) => {
      if (!token) throw new Error('กรุณาเข้าสู่ระบบ');
      const created = await ticketsApi.createBroadcast(token, input);
      apply(ticketsRef.current, [created, ...broadcastsRef.current]);
      return created;
    },
    [apply, token],
  );

  const endBroadcast = useCallback(
    async (id: string) => {
      if (!token) throw new Error('กรุณาเข้าสู่ระบบ');
      await ticketsApi.endBroadcast(token, id);
      apply(
        ticketsRef.current,
        broadcastsRef.current.filter((b) => b.id !== id),
      );
    },
    [apply, token],
  );

  const value: TicketsValue = {
    tickets,
    broadcasts,
    status,
    error,
    offlineSince,
    queued,
    refresh,
    getById: (id) => tickets.find((t) => t.id === id),
    create,
    act,
    load,
    broadcast,
    endBroadcast,
  };
  return <TicketsContext.Provider value={value}>{children}</TicketsContext.Provider>;
}

export function useTickets(): TicketsValue {
  const value = useContext(TicketsContext);
  if (!value) throw new Error('useTickets ต้องใช้ภายใน TicketsProvider');
  return value;
}
