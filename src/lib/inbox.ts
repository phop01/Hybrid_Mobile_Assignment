// กล่องแจ้งเตือน: ตัดสินว่าอันไหนใหม่ต้องเด้ง และแตะแล้วไปหน้าไหน (ฟังก์ชันล้วน)

import type { InboxItem } from '@/types/models';

/**
 * รวมรายการใหม่เข้ากับของเดิม (ไม่ซ้ำ id, ใหม่สุดก่อน, เก็บไม่เกิน max)
 * คืน fresh = รายการที่ยังไม่เคยเห็น ใช้เด้งแจ้งเตือนในเครื่อง
 */
export function mergeInbox(
  existing: InboxItem[],
  incoming: InboxItem[],
  max = 100,
): { items: InboxItem[]; fresh: InboxItem[] } {
  const known = new Set(existing.map((i) => i.id));
  const fresh = incoming.filter((i) => !known.has(i.id));
  const items = [...fresh, ...existing].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, max);
  return { items, fresh: [...fresh].sort((a, b) => a.createdAt.localeCompare(b.createdAt)) };
}

/** เวลาที่ใช้ถามรอบถัดไป = ของใหม่สุดที่เคยได้ (ไม่มี → ใช้ fallback) */
export function latestCreatedAt(items: InboxItem[], fallback: string): string {
  return items.reduce((max, i) => (i.createdAt > max ? i.createdAt : max), fallback);
}

export function unreadCount(items: InboxItem[], readUntil: string | null): number {
  if (!readUntil) return items.length;
  return items.filter((i) => i.createdAt > readUntil).length;
}

// id ใน payload แจ้งเตือนมาจากภายนอก ตรวจรูปแบบก่อนใช้เป็น route param
const ID_PATTERN = /^[\w-]{1,64}$/;

export type InboxTarget =
  | { pathname: '/tickets/[id]'; params: { id: string } }
  | { pathname: '/activities/[id]'; params: { id: string } }
  | { pathname: '/registrations/[id]'; params: { id: string } }
  | { pathname: '/organizer/[id]'; params: { id: string } }
  | { pathname: '/'; params?: undefined };

/** แตะแจ้งเตือน/รายการในกล่อง → หน้าที่เกี่ยวข้อง (null = ข้อมูลไม่ถูกต้อง ไม่ต้องไปไหน) */
export function targetFor(kind: unknown, targetId: unknown): InboxTarget | null {
  if (kind === 'broadcast') return { pathname: '/' };
  if (typeof targetId !== 'string' || !ID_PATTERN.test(targetId)) return null;
  const params = { id: targetId };
  switch (kind) {
    case 'ticket':
      return { pathname: '/tickets/[id]', params };
    case 'activity':
      return { pathname: '/activities/[id]', params };
    case 'registration':
      return { pathname: '/registrations/[id]', params };
    case 'manage':
      return { pathname: '/organizer/[id]', params };
    default:
      return null;
  }
}
