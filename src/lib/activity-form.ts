// ฟอร์มสร้างกิจกรรมของผู้จัด (สัปดาห์ 5): แปลงค่าที่กรอก → ข้อมูลที่ส่ง API พร้อมตรวจความถูกต้อง
// เป็นฟังก์ชันล้วน ทดสอบได้โดยไม่ต้อง render หน้าจอ (สัปดาห์ 13) และ server ตรวจซ้ำอีกรอบ

import type { Category, CheckInMethod, NewActivityInput } from '@/types/models';

export type ActivityFormValues = {
  title: string;
  description: string;
  category: Category;
  /** 0 = วันนี้, 1 = พรุ่งนี้ ... */
  dayOffset: number;
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  locationName: string;
  latitude: number | null;
  longitude: number | null;
  radiusM: number;
  checkInMethod: CheckInMethod;
  capacity: string;
};

export type ActivityFormErrors = Partial<
  Record<'title' | 'description' | 'startTime' | 'endTime' | 'locationName' | 'location' | 'capacity', string>
>;

export const MAX_ACTIVITY_HOURS = 12;

export function emptyActivityForm(): ActivityFormValues {
  return {
    title: '',
    description: '',
    category: 'academic',
    dayOffset: 1,
    startTime: '09:00',
    endTime: '12:00',
    locationName: '',
    latitude: null,
    longitude: null,
    radiusM: 150,
    checkInMethod: 'app',
    capacity: '50',
  };
}

const TIME = /^([01]?\d|2[0-3]):([0-5]\d)$/;

/** วันที่ + "HH:MM" (เวลาเครื่อง) → Date หรือ null ถ้ารูปแบบเวลาผิด */
export function atTime(now: number, dayOffset: number, hhmm: string): Date | null {
  const match = TIME.exec(hhmm.trim());
  if (!match) return null;
  const date = new Date(now);
  date.setDate(date.getDate() + dayOffset);
  date.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return date;
}

/** ชั่วโมงกิจกรรม = ระยะเวลางาน ปัดเป็นครึ่งชั่วโมง (ตรงกับที่ server คำนวณ) */
export function activityHours(startsAt: Date, endsAt: Date): number {
  const hours = (endsAt.getTime() - startsAt.getTime()) / 3_600_000;
  return Math.max(0.5, Math.round(hours * 2) / 2);
}

export function buildActivityInput(
  v: ActivityFormValues,
  now = Date.now(),
): { ok: true; input: NewActivityInput; hours: number } | { ok: false; errors: ActivityFormErrors } {
  const errors: ActivityFormErrors = {};
  const title = v.title.trim();
  if (title.length < 5 || title.length > 100) errors.title = 'ชื่อกิจกรรมต้องยาว 5–100 ตัวอักษร';
  const description = v.description.trim();
  if (description.length < 10 || description.length > 1000) errors.description = 'รายละเอียดอย่างน้อย 10 ตัวอักษร';

  const start = atTime(now, v.dayOffset, v.startTime);
  const end = atTime(now, v.dayOffset, v.endTime);
  if (!start) errors.startTime = 'รูปแบบเวลา เช่น 09:00';
  else if (start.getTime() < now - 60 * 60 * 1000) errors.startTime = 'เวลาเริ่มผ่านไปแล้ว';
  if (!end) errors.endTime = 'รูปแบบเวลา เช่น 12:00';
  else if (start && end.getTime() <= start.getTime()) errors.endTime = 'เวลาจบต้องหลังเวลาเริ่ม';
  else if (start && end.getTime() - start.getTime() > MAX_ACTIVITY_HOURS * 3_600_000) {
    errors.endTime = `กิจกรรมยาวได้ไม่เกิน ${MAX_ACTIVITY_HOURS} ชั่วโมง`;
  }

  if (v.locationName.trim().length < 2) errors.locationName = 'กรุณาระบุชื่อสถานที่ เช่น ห้องประชุมใหญ่';
  if (v.latitude === null || v.longitude === null) errors.location = 'กรุณาปักหมุดสถานที่บนแผนที่';

  const capacity = Number(v.capacity);
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 2000) errors.capacity = 'จำนวนรับต้องเป็น 1–2000 คน';

  if (Object.keys(errors).length > 0 || !start || !end) return { ok: false, errors };
  return {
    ok: true,
    hours: activityHours(start, end),
    input: {
      title,
      description,
      category: v.category,
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      location: { name: v.locationName.trim(), latitude: v.latitude!, longitude: v.longitude!, radiusM: v.radiusM },
      checkInMethod: v.checkInMethod,
      capacity,
    },
  };
}
