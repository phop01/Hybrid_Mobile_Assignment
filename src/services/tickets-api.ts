// API ส่วนแจ้งซ่อม / ประกาศ / กล่องแจ้งเตือน (ตรงกับ server/tickets.mjs)

import type { Broadcast, InboxItem, NewBroadcastInput, NewTicketInput, Ticket } from '@/types/models';

import { apiRequest } from './api-client';
import { isBroadcast, isInboxItem, isTicket, parseList, parseOne } from './validators';

export async function getTickets(token: string, signal?: AbortSignal): Promise<Ticket[]> {
  return parseList(await apiRequest('/tickets', { token, signal }), isTicket, 'เรื่องแจ้ง');
}

export async function getTicket(token: string, id: string, signal?: AbortSignal): Promise<Ticket> {
  return parseOne(await apiRequest(`/tickets/${encodeURIComponent(id)}`, { token, signal }), isTicket, 'เรื่องแจ้ง');
}

/** idempotencyKey เดิมเมื่อส่งซ้ำ (เช่น จากคิวออฟไลน์) server คืนเรื่องเดิม ไม่สร้างใหม่ */
export async function createTicket(token: string, input: NewTicketInput, idempotencyKey: string): Promise<Ticket> {
  const payload = await apiRequest('/tickets', { method: 'POST', token, body: input, idempotencyKey });
  return parseOne(payload, isTicket, 'เรื่องแจ้ง');
}

export type TicketAction =
  | { type: 'follow' }
  | { type: 'accept'; appointmentAt?: string | null }
  | { type: 'release' }
  | { type: 'schedule'; appointmentAt: string }
  | { type: 'done'; photoBase64?: string; note?: string }
  | { type: 'confirm' }
  | { type: 'reopen'; note: string }
  | { type: 'reject'; note: string }
  | { type: 'cancel' };

export async function runTicketAction(token: string, id: string, action: TicketAction): Promise<Ticket> {
  const { type, ...body } = action;
  const payload = await apiRequest(`/tickets/${encodeURIComponent(id)}/${type}`, { method: 'POST', token, body });
  return parseOne(payload, isTicket, 'เรื่องแจ้ง');
}

/** แจ้งเตือนของฉันที่ใหม่กว่า since (ISO) ใหม่สุดก่อน */
export async function getInbox(token: string, since: string, signal?: AbortSignal): Promise<InboxItem[]> {
  const payload = await apiRequest(`/me/inbox?since=${encodeURIComponent(since)}`, { token, signal });
  return parseList(payload, isInboxItem, 'แจ้งเตือน');
}

export async function getBroadcasts(token: string, signal?: AbortSignal): Promise<Broadcast[]> {
  return parseList(await apiRequest('/broadcasts', { token, signal }), isBroadcast, 'ประกาศ');
}

export async function createBroadcast(token: string, input: NewBroadcastInput): Promise<Broadcast> {
  return parseOne(await apiRequest('/broadcasts', { method: 'POST', token, body: input }), isBroadcast, 'ประกาศ');
}

export async function endBroadcast(token: string, id: string): Promise<Broadcast> {
  const payload = await apiRequest(`/broadcasts/${encodeURIComponent(id)}/end`, { method: 'POST', token });
  return parseOne(payload, isBroadcast, 'ประกาศ');
}
