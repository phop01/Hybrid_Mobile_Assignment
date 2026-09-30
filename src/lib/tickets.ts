// กฎของเรื่องแจ้งซ่อม (ฟังก์ชันล้วน ทดสอบได้โดยไม่ต้องมีหน้าจอ)
// server ตรวจกฎชุดเดียวกันซ้ำเสมอ ฝั่งแอปใช้แค่ตัดสินว่าจะโชว์ปุ่มไหน

import type { IconName } from '@/components/ui';
import type { Coordinates } from '@/lib/geo';
import { distanceMeters } from '@/lib/geo';
import type { Department, RepairCategory, Role, Ticket, TicketCategory, TicketKind, TicketStatus } from '@/types/models';

type Actor = { id: string; role: Role; department?: Department };

/** เจ้าหน้าที่อาคารสถานที่: รับงานแจ้งซ่อม */
export const isFacilities = (user: Actor | null | undefined) => user?.role === 'organizer' && user.department === 'facilities';
/** เจ้าหน้าที่กิจกรรม: สร้างกิจกรรม ตรวจหลักฐาน */
export const isActivitiesStaff = (user: Actor | null | undefined) =>
  user?.role === 'organizer' && user.department === 'activities';

type Info = { label: string; icon: IconName };

export const KIND_INFO: Record<TicketKind, Info & { color: string; soft: string }> = {
  // สีตัวอักษรบนพื้น soft ผ่าน 4.5:1 ทั้งคู่
  repair: { label: 'แจ้งซ่อม', icon: 'construct', color: '#B45309', soft: '#FEF3E2' },
};

export const REPAIR_CATEGORIES: Record<RepairCategory, Info> = {
  electric: { label: 'ไฟฟ้า/แสงสว่าง', icon: 'flash' },
  water: { label: 'ประปา/ห้องน้ำ', icon: 'water' },
  building: { label: 'อาคาร/ห้องเรียน', icon: 'business' },
  road: { label: 'ถนน/ทางเดิน', icon: 'walk' },
  cleaning: { label: 'ความสะอาด/ขยะ', icon: 'trash' },
  other: { label: 'อื่น ๆ', icon: 'ellipsis-horizontal-circle' },
};

export const REPAIR_ORDER: RepairCategory[] = ['electric', 'water', 'building', 'road', 'cleaning', 'other'];

export function categoryInfo(_kind: TicketKind, category: TicketCategory): Info {
  return REPAIR_CATEGORIES[category] ?? { label: 'อื่น ๆ', icon: 'ellipsis-horizontal-circle' };
}

const STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'รอเจ้าหน้าที่รับเรื่อง',
  accepted: 'กำลังดำเนินการ',
  done: 'รอผู้แจ้งยืนยัน',
  confirmed: 'ซ่อมเรียบร้อย',
  rejected: 'ไม่ดำเนินการ',
  cancelled: 'ยกเลิกแล้ว',
};

/** คนอ่านเข้าใจทันทีว่าตอนนี้เรื่องอยู่ตรงไหน */
export function statusLabel(ticket: Pick<Ticket, 'kind' | 'status'>): string {
  return STATUS_LABELS[ticket.status];
}

export type StatusTone = 'warning' | 'info' | 'success' | 'muted' | 'danger';

export function statusTone(status: TicketStatus): StatusTone {
  if (status === 'open') return 'warning';
  if (status === 'accepted' || status === 'done') return 'info';
  if (status === 'confirmed') return 'success';
  if (status === 'rejected') return 'danger';
  return 'muted';
}

export const isActive = (t: Pick<Ticket, 'status'>) => t.status === 'open' || t.status === 'accepted' || t.status === 'done';

/** ปุ่มที่ผู้ใช้คนนี้กดได้กับเรื่องนี้ (ลำดับ = ลำดับที่แสดง ปุ่มแรกคือปุ่มหลัก) */
export type TicketButton =
  | 'accept'
  | 'follow'
  | 'unfollow'
  | 'schedule'
  | 'done'
  | 'release'
  | 'confirm'
  | 'reopen'
  | 'reject'
  | 'cancel';

export function availableActions(ticket: Ticket, user: Actor): TicketButton[] {
  const mine = ticket.reporterId === user.id;
  const assigned = ticket.assigneeId === user.id;
  // งานซ่อมเป็นหน้าที่ของอาคารสถานที่เท่านั้น เจ้าหน้าที่กิจกรรมแจ้งซ่อมได้เหมือนคนทั่วไป
  const facilities = isFacilities(user);
  const buttons: TicketButton[] = [];

  if (ticket.status === 'open' && !mine && facilities) buttons.push('accept');
  if (ticket.status === 'accepted' && assigned) buttons.push('done', 'schedule', 'release');
  if (ticket.status === 'done' && mine) buttons.push('confirm', 'reopen');
  if (!mine && !facilities && (ticket.status === 'open' || ticket.status === 'accepted')) {
    buttons.push(ticket.following ? 'unfollow' : 'follow');
  }
  if (facilities && (ticket.status === 'open' || ticket.status === 'accepted')) buttons.push('reject');
  if (mine && (ticket.status === 'open' || ticket.status === 'accepted')) buttons.push('cancel');
  return buttons;
}

/** รัศมีที่ถือว่า "จุดเดียวกัน" ตอนกันแจ้งซ้ำ */
export const DUPLICATE_RADIUS_M = 50;

/**
 * เรื่องแจ้งซ่อมหมวดเดียวกันที่ยังไม่ปิด และอยู่ใกล้จุดที่กำลังจะแจ้ง (ใกล้สุดก่อน)
 * ใช้เตือนก่อนส่ง: ถ้ามีคนแจ้งไว้แล้ว กด "เจอเหมือนกัน" ดีกว่าแจ้งซ้ำ เจ้าหน้าที่จะเห็นว่าเรื่องนี้กระทบหลายคน
 */
export function findDuplicates(
  tickets: Ticket[],
  point: Coordinates,
  category: TicketCategory,
  radius = DUPLICATE_RADIUS_M,
): { ticket: Ticket; distance: number }[] {
  return tickets
    .filter((t) => t.kind === 'repair' && t.category === category && (t.status === 'open' || t.status === 'accepted'))
    .map((t) => ({ ticket: t, distance: distanceMeters(point, t.location) }))
    .filter((x) => x.distance <= radius)
    .sort((a, b) => a.distance - b.distance);
}

/** ความปลอดภัยต้องมาก่อน: ไฟฟ้า/ถนนเสียมีคนเจ็บได้ */
const URGENT_CATEGORIES: TicketCategory[] = ['electric', 'road'];

/**
 * คะแนนความเร่งด่วนของคิวงานเจ้าหน้าที่ (มาก = ทำก่อน)
 * คนเจอเหมือนกันมาก = กระทบหลายคน, รอนาน = ไม่ควรถูกลืม, หมวดอันตราย = บวกเพิ่ม
 */
export function urgencyScore(ticket: Ticket, now = Date.now()): number {
  const waitingHours = Math.max(0, (now - Date.parse(ticket.createdAt)) / 3600000);
  return ticket.followerCount * 3 + Math.min(waitingHours, 72) / 6 + (URGENT_CATEGORIES.includes(ticket.category) ? 4 : 0);
}

export function sortByUrgency(tickets: Ticket[], now = Date.now()): Ticket[] {
  return [...tickets].sort((a, b) => urgencyScore(b, now) - urgencyScore(a, now));
}

const EVENT_LABELS: Record<string, string> = {
  created: 'แจ้งเรื่อง',
  accepted: 'รับเรื่อง',
  released: 'คืนเรื่อง',
  scheduled: 'นัดเวลา',
  done: 'แจ้งว่าเสร็จแล้ว',
  confirmed: 'ยืนยันว่าเรียบร้อย',
  reopened: 'บอกว่ายังไม่เรียบร้อย',
  rejected: 'ไม่ดำเนินการ',
  cancelled: 'ยกเลิกเรื่อง',
};

export function eventLabel(type: string): string {
  return EVENT_LABELS[type] ?? type;
}
