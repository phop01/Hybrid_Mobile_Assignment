import type { Activity, Registration } from '@/types/models';

/** เปิดให้เช็กอินก่อนงานเริ่ม 30 นาที (เวลาเดียวกับที่แจ้งเตือน) */
export const CHECK_IN_OPENS_BEFORE_MS = 30 * 60 * 1000;

export type CheckInBlock = 'not_registered' | 'already_submitted';

export type CheckInDecision = { ok: true } | { ok: false; reason: CheckInBlock; message: string };

export function checkInOpensAt(activity: Activity): Date {
  return new Date(new Date(activity.startsAt).getTime() - CHECK_IN_OPENS_BEFORE_MS);
}

/**
 * ส่งหลักฐานการเข้าร่วมได้ไหม: ดูแค่สถานะการลงทะเบียน
 * ไม่ตรวจตำแหน่ง/เวลา (ผู้ใช้ตัดสินใจ แชทที่ 3) ตำแหน่งที่ได้ถูกบันทึกไว้ให้เจ้าหน้าที่ดูประกอบการตรวจ
 */
export function canCheckIn(registration: Registration): CheckInDecision {
  if (registration.status === 'pending_review' || registration.status === 'checked_in') {
    return { ok: false, reason: 'already_submitted', message: 'ส่งหลักฐานการเข้าร่วมไปแล้ว' };
  }
  if (registration.status === 'rejected') {
    return { ok: false, reason: 'not_registered', message: 'การลงทะเบียนนี้ไม่ได้รับอนุมัติ' };
  }
  if (registration.status !== 'registered') {
    return { ok: false, reason: 'not_registered', message: 'การลงทะเบียนนี้ถูกยกเลิกแล้ว' };
  }
  return { ok: true };
}

/** ตัวเลือกเวลาแจ้งเตือนล่วงหน้า (นาทีก่อนงานเริ่ม) สำเร็จรูป · ผู้ใช้กำหนดเองได้อีก (formatLead / customLeadProblem) */
export const REMINDER_LEADS = [
  { minutes: 24 * 60, label: 'ล่วงหน้า 1 วัน' },
  { minutes: 3 * 60, label: 'ล่วงหน้า 3 ชม.' },
  { minutes: 60, label: 'ล่วงหน้า 1 ชม.' },
  { minutes: CHECK_IN_OPENS_BEFORE_MS / 60000, label: 'ล่วงหน้า 30 นาที' },
  { minutes: 15, label: 'ล่วงหน้า 15 นาที' },
] as const;

/** กำหนดเองได้สูงสุด 7 วันก่อนงาน (แจ้งเตือนเกินนั้นลืมไปก่อนถึงงาน) */
export const MAX_CUSTOM_LEAD_MINUTES = 7 * 24 * 60;

export function reminderTime(activity: Activity, leadMinutes: number): Date {
  return new Date(new Date(activity.startsAt).getTime() - leadMinutes * 60000);
}

/** ซ่อนตัวเลือกที่เลยเวลาไปแล้ว เช่น งานพรุ่งนี้เช้าตั้ง "ล่วงหน้า 1 วัน" ไม่ได้ */
export function availableReminderLeads(activity: Activity, now = Date.now()) {
  return REMINDER_LEADS.filter((lead) => reminderTime(activity, lead.minutes).getTime() > now);
}

/** นาทีเป็นข้อความสั้น ๆ: 150 → "2 ชม. 30 นาที", 1500 → "1 วัน 1 ชม." */
export function formatLead(minutes: number): string {
  const days = Math.floor(minutes / (24 * 60));
  const hours = Math.floor((minutes % (24 * 60)) / 60);
  const mins = minutes % 60;
  const parts = [days ? `${days} วัน` : '', hours ? `${hours} ชม.` : '', mins ? `${mins} นาที` : ''].filter(Boolean);
  return parts.length ? parts.join(' ') : '0 นาที';
}

/** ตรวจเวลาที่กำหนดเอง: คืนเหตุผลถ้าใช้ไม่ได้ / null ถ้าใช้ได้ */
export function customLeadProblem(activity: Activity, minutes: number, now = Date.now()): string | null {
  if (!Number.isInteger(minutes) || minutes < 1) return 'ต้องเตือนก่อนงานอย่างน้อย 1 นาที';
  if (minutes > MAX_CUSTOM_LEAD_MINUTES) return 'เตือนล่วงหน้าได้ไม่เกิน 7 วัน';
  if (reminderTime(activity, minutes).getTime() <= now) return 'เวลานี้ผ่านไปแล้ว ลองลดเวลาล่วงหน้าลง';
  return null;
}

/** ตรวจ "นับถอยหลังจากตอนนี้" (หน่วยวินาที): อย่างน้อย 5 วินาที และต้องเตือนก่อนงานจบ คืนเหตุผลถ้าใช้ไม่ได้ / null ถ้าใช้ได้ */
export function countdownProblem(activity: Activity, seconds: number, now = Date.now()): string | null {
  if (!Number.isInteger(seconds) || seconds < 5) return 'ต้องนับถอยหลังอย่างน้อย 5 วินาที';
  if (now + seconds * 1000 >= new Date(activity.endsAt).getTime()) return 'เวลานี้เลยเวลาจบงานแล้ว ลองลดเวลาลง';
  return null;
}

/** วินาทีเป็นข้อความสั้น ๆ: 90 → "1 นาที 30 วินาที", 3600 → "1 ชม." */
export function formatCountdown(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const parts = [hours ? `${hours} ชม.` : '', mins ? `${mins} นาที` : '', secs ? `${secs} วินาที` : ''].filter(Boolean);
  return parts.length ? parts.join(' ') : '0 วินาที';
}
