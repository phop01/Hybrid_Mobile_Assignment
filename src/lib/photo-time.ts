import type { PhotoSource } from '@/types/models';

export const PHOTO_SOURCE_LABEL: Record<PhotoSource, string> = {
  camera: 'ถ่ายสด',
  library: 'จากคลังรูป',
};

// อ่านเวลาถ่ายจริงของรูปจากคลังภาพ (EXIF)
// เหตุผล: รูปจากคลังอาจเป็นรูปเก่า ต้องใช้เวลาถ่ายจริงให้ server ตรวจว่าอยู่ในช่วงงาน ไม่ใช่เวลาที่กดเลือก

const EXIF_DATE = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/;
const OFFSET = /^([+-])(\d{2}):(\d{2})$/;

/**
 * EXIF เก็บเวลาแบบ "2026:09:24 10:15:30" ไม่มีโซนเวลา
 * - มี OffsetTimeOriginal (เช่น "+07:00") → ใช้โซนนั้น
 * - ไม่มี → ถือเป็นเวลาเครื่อง (รูปถ่ายด้วยมือถือเครื่องเดียวกัน)
 * คืน null ถ้าไม่มีเวลาถ่าย เช่น รูปแคปหน้าจอ หรือรูปที่ส่งผ่านแชต (แอปแชตมักลบ EXIF ทิ้ง)
 */
export function parseExifTakenAt(exif: Record<string, unknown> | null | undefined): string | null {
  if (!exif) return null;
  const raw = exif.DateTimeOriginal ?? exif.DateTimeDigitized;
  if (typeof raw !== 'string') return null;
  const m = EXIF_DATE.exec(raw.trim());
  if (!m) return null;
  const [year, month, day, hour, minute, second] = m.slice(1).map(Number);

  const offset = typeof exif.OffsetTimeOriginal === 'string' ? OFFSET.exec(exif.OffsetTimeOriginal.trim()) : null;
  let time: number;
  if (offset) {
    const sign = offset[1] === '-' ? -1 : 1;
    const offsetMin = sign * (Number(offset[2]) * 60 + Number(offset[3]));
    time = Date.UTC(year, month - 1, day, hour, minute, second) - offsetMin * 60 * 1000;
  } else {
    time = new Date(year, month - 1, day, hour, minute, second).getTime();
  }
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}
