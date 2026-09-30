export type Coordinates = { latitude: number; longitude: number };

const EARTH_RADIUS_M = 6371000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/**
 * ระยะทางบนผิวโลกระหว่างสองพิกัด (สูตร haversine)
 * คำนวณในเครื่องได้เลย ไม่ต้องเรียก API แผนที่
 */
export function distanceMeters(a: Coordinates, b: Coordinates): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** ความเร็วเดินเฉลี่ย ~4.8 กม./ชม. */
const WALK_METERS_PER_MINUTE = 80;

/** เวลาเดินโดยประมาณ (นาที ปัดขึ้น อย่างน้อย 1) คิดจากระยะเส้นตรง จึงเป็นค่าต่ำสุดที่เป็นไปได้ */
export function walkingMinutes(meters: number): number {
  return Math.max(1, Math.ceil(meters / WALK_METERS_PER_MINUTE));
}

/** ใกล้เป้าหมายเท่านี้ถือว่า "ถึงแล้ว" (GPS ในเมืองคลาดเคลื่อนได้ราว 10–20 ม.) */
export const ARRIVED_RADIUS_M = 30;

/** ตรวจพิกัดที่มาจากภายนอก (เช่น route params / deep link) คืน null ถ้าไม่ใช่พิกัดจริง */
export function parseCoordinates(lat: unknown, lng: unknown): Coordinates | null {
  const latitude = typeof lat === 'string' && lat.trim() !== '' ? Number(lat) : NaN;
  const longitude = typeof lng === 'string' && lng.trim() !== '' ? Number(lng) : NaN;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

export type Region = Coordinates & { latitudeDelta: number; longitudeDelta: number };

/**
 * กรอบแผนที่ที่เห็นทุกจุด (+ ขอบเผื่อ 30%) ใช้ตั้งมุมมองแรกของแผนที่รวมกิจกรรม
 * จุดเดียวหรือจุดใกล้กันมาก ใช้กรอบขั้นต่ำ ไม่ซูมจนเห็นแค่หลังคาอาคาร
 */
export function regionFor(points: Coordinates[], minDelta = 0.01): Region | null {
  if (points.length === 0) return null;
  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(minDelta, (maxLat - minLat) * 1.3),
    longitudeDelta: Math.max(minDelta, (maxLng - minLng) * 1.3),
  };
}
