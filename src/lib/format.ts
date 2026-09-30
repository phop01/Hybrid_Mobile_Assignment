// จัดรูปแบบวันเวลาเป็นภาษาไทย
// เขียนเองแทนการพึ่ง Intl ทั้งหมด เพราะ Hermes บนมือถือบางรุ่นรองรับ locale ไม่ครบ

const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const THAI_DAYS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];

const pad = (n: number) => String(n).padStart(2, '0');

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${THAI_DAYS[d.getDay()]} ${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}

/** "ส. 26 ก.ย. 2569 · 09:00–12:00" */
export function formatDateRange(startIso: string, endIso: string): string {
  const sameDay = new Date(startIso).toDateString() === new Date(endIso).toDateString();
  return sameDay
    ? `${formatDate(startIso)} · ${formatTime(startIso)}–${formatTime(endIso)}`
    : `${formatDate(startIso)} ${formatTime(startIso)} – ${formatDate(endIso)} ${formatTime(endIso)}`;
}

/** "เมื่อสักครู่" / "5 นาทีที่แล้ว" / "14:05" ใช้กับแถบออฟไลน์ */
export function formatUpdatedAt(iso: string, now = Date.now()): string {
  const diffMin = Math.floor((now - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return 'เมื่อสักครู่';
  if (diffMin < 60) return `${diffMin} นาทีที่แล้ว`;
  return `${formatDate(iso)} ${formatTime(iso)}`;
}

export function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters)} ม.` : `${(meters / 1000).toFixed(1)} กม.`;
}

/** ระยะจากจุดจัดงานตอนส่งหลักฐาน (ไม่บังคับตำแหน่ง: null = ไม่มีข้อมูล) */
export function formatVenueDistance(meters: number | null): string {
  return meters === null ? 'ไม่มีข้อมูลตำแหน่ง' : `ห่างจุดจัดงาน ${formatDistance(meters)}`;
}
