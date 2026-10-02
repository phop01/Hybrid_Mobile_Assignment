// API ส่วนประกาศ / กล่องแจ้งเตือน (ตรงกับ server/broadcasts.mjs)

import type { Broadcast, InboxItem, NewBroadcastInput } from '@/types/models';

import { apiRequest } from './api-client';
import { isBroadcast, isInboxItem, parseList, parseOne } from './validators';

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
