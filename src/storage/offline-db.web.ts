// เวอร์ชันเว็บของ offline-db
// SQLite บนเว็บต้องตั้งค่า WebAssembly และ header พิเศษของ server
// จึงใช้ AsyncStorage (localStorage) แทน โดยคง API เดิมไว้ หน้าจอไม่ต้องรู้ว่าข้างหลังใช้อะไร

import type { PendingCheckIn, Registration } from '@/types/models';
import { isRegistration } from '@/services/validators';

import { readJson, removeKeys, writeJson } from './kv';

const regKey = (userId: string) => `nktoday/registrations/${userId}/v1`;
const QUEUE_KEY = 'nktoday/checkin-queue/v1';

type RegCache = { registrations: Registration[]; updatedAt: string };
const isRegCache = (v: unknown): v is RegCache | null =>
  v === null ||
  (typeof v === 'object' &&
    typeof (v as RegCache).updatedAt === 'string' &&
    Array.isArray((v as RegCache).registrations) &&
    (v as RegCache).registrations.every(isRegistration));
const isQueue = (v: unknown): v is PendingCheckIn[] => Array.isArray(v);

let lastUserId: string | null = null;

export async function saveRegistrationsCache(userId: string, registrations: Registration[]): Promise<void> {
  lastUserId = userId;
  await writeJson(regKey(userId), { registrations, updatedAt: new Date().toISOString() });
}

export function loadRegistrationsCache(userId: string): Promise<RegCache | null> {
  lastUserId = userId;
  return readJson(regKey(userId), isRegCache, null);
}

export async function enqueueCheckIn(item: PendingCheckIn): Promise<void> {
  const queue = await listQueuedCheckIns();
  await writeJson(QUEUE_KEY, [...queue.filter((q) => q.registrationId !== item.registrationId), item]);
}

export function listQueuedCheckIns(): Promise<PendingCheckIn[]> {
  return readJson(QUEUE_KEY, isQueue, []);
}

export async function removeQueuedCheckIn(registrationId: string): Promise<void> {
  const queue = await listQueuedCheckIns();
  await writeJson(QUEUE_KEY, queue.filter((q) => q.registrationId !== registrationId));
}

export async function clearOfflineData(): Promise<void> {
  await removeKeys([QUEUE_KEY, ...(lastUserId ? [regKey(lastUserId)] : [])]);
}
