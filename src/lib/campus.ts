// อาคารและสถานที่ใน มข. วิทยาเขตหนองคาย (แหล่งเดียวทั้งแอปและ server: src/data/campus-places.json)
// ที่มา: แผนผัง "KKU NKC MAP" ของวิทยาเขต จับคู่กับรูปอาคาร/สระ/สนามใน OpenStreetMap เพื่อได้พิกัดจริง
// แก้ชื่อหรือย้ายตำแหน่งอาคาร: แก้ไฟล์ JSON ไฟล์เดียว แผนที่และฟอร์มทุกหน้าเปลี่ยนตาม

import raw from '@/data/campus-places.json';
import { distanceMeters, type Coordinates } from '@/lib/geo';

export type CampusPlaceKind = 'building' | 'dorm' | 'sport' | 'canteen' | 'other';

export type CampusPlace = Coordinates & {
  id: string;
  name: string;
  /** ชื่อสั้นสำหรับป้ายบนแผนที่ */
  shortName: string;
  kind: CampusPlaceKind;
  /** เลขอาคารในรหัสห้อง NKxxxx (เช่น 2 = อครเก่า) */
  code?: number;
  /** ป้ายรอง (โรงจอดรถ สระน้ำ โรงเรียนสาธิต) แสดงเฉพาะตอนซูมใกล้ ไม่ให้ป้ายทับกัน */
  minor?: boolean;
};

export const CAMPUS_PLACES: CampusPlace[] = raw as CampusPlace[];

/** กลางวิทยาเขต (ใช้เป็นจุดเริ่มของแผนที่) */
export const CAMPUS_CENTER: Coordinates = { latitude: 17.8045, longitude: 102.7473 };

/** อาคารที่นัดกันบ่อย (ขึ้นเป็นปุ่มลัดในฟอร์ม) — ไม่รวมสระน้ำ/ประตู */
export const PICKABLE_PLACES = CAMPUS_PLACES.filter((p) => p.kind !== 'other' || p.id === 'carpark');

/** อาคารที่ใกล้ที่สุดในระยะ maxMeters (ไม่มี → null) ใช้เดาอาคารจาก GPS */
export function nearestPlace(point: Coordinates, maxMeters = 120, places = CAMPUS_PLACES): { place: CampusPlace; distance: number } | null {
  let best: { place: CampusPlace; distance: number } | null = null;
  for (const place of places) {
    const distance = distanceMeters(point, place);
    if (distance <= maxMeters && (!best || distance < best.distance)) best = { place, distance };
  }
  return best;
}

export type RoomCode = { place: CampusPlace; floor: number; room: number; label: string };

/**
 * อ่านรหัสห้องของวิทยาเขต: NK + เลขอาคาร 1 หลัก + ชั้น 1 หลัก + ห้อง 2 หลัก
 * เช่น NK2217 = อาคารเรียนรวม 1 (อครเก่า) ชั้น 2 ห้อง 17 · อาคารที่ไม่รู้จัก → null
 */
export function parseRoomCode(text: string, places = CAMPUS_PLACES): RoomCode | null {
  const match = /\bNK\s?(\d)(\d)(\d{2})\b/i.exec(text.trim());
  if (!match) return null;
  const place = places.find((p) => p.code === Number(match[1]));
  if (!place) return null;
  const floor = Number(match[2]);
  const room = Number(match[3]);
  return { place, floor, room, label: `${place.name} ชั้น ${floor} ห้อง NK${match[1]}${match[2]}${match[3]}` };
}
