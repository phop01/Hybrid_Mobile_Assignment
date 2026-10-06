// API ส่วนกล่องแจ้งเตือน (ตรงกับ server/inbox.mjs)

import type { InboxItem } from '@/types/models';

import { apiRequest } from './api-client';
import { isInboxItem } from './validators';

/** แจ้งเตือนของฉันที่ใหม่กว่า since (ISO) ใหม่สุดก่อน */
export async function getInbox(token: string, since: string, signal?: AbortSignal): Promise<InboxItem[]> {
  const payload = await apiRequest(`/me/inbox?since=${encodeURIComponent(since)}`, { token, signal });
  if (!Array.isArray(payload)) throw new Error('รูปแบบข้อมูลแจ้งเตือนจาก server ไม่ถูกต้อง');
  // ข้ามแจ้งเตือนชนิดที่แอปไม่รู้จัก (เช่น ของฟีเจอร์ที่เอาออกไปแล้ว) แทนที่จะทำให้ทั้งกล่องโหลดไม่ขึ้น
  return payload.filter(isInboxItem);
}
