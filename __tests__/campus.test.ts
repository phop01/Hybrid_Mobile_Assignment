// ข้อมูลอาคารของวิทยาเขต (src/data/campus-places.json) และรหัสห้อง NKxxxx
import { CAMPUS_CENTER, CAMPUS_PLACES, nearestPlace, parseRoomCode } from '@/lib/campus';
import { distanceMeters } from '@/lib/geo';

describe('campus places data', () => {
  it('has unique ids and every place is inside the campus area', () => {
    const ids = CAMPUS_PLACES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const place of CAMPUS_PLACES) {
      // พิกัดพิมพ์ผิด (เช่น สลับละติจูด/ลองจิจูด) จะหลุดออกนอกรัศมีนี้ทันที
      expect(distanceMeters(place, CAMPUS_CENTER)).toBeLessThan(1500);
      // ชื่อเต็มของอาคารเรียนรวมยาว ~34 ตัวอักษร ป้ายยาวกว่านี้จะบังอาคารข้าง ๆ
      expect(place.shortName.length).toBeLessThanOrEqual(40);
    }
  });

  it('knows the building codes used in room numbers', () => {
    expect(CAMPUS_PLACES.filter((p) => p.code !== undefined).map((p) => p.code).sort()).toEqual([1, 2, 6]);
  });
});

describe('nearestPlace', () => {
  it('finds the building you are standing next to', () => {
    const near = nearestPlace({ latitude: 17.80312, longitude: 102.74812 });
    expect(near?.place.id).toBe('classroom-1');
  });

  it('returns null when nothing is close enough', () => {
    expect(nearestPlace({ latitude: 17.82, longitude: 102.76 })).toBeNull();
  });
});

describe('parseRoomCode', () => {
  it('reads NK + building + floor + room', () => {
    const code = parseRoomCode('หน้าห้อง NK2217');
    expect(code?.place.id).toBe('classroom-1');
    expect(code).toMatchObject({ floor: 2, room: 17 });
    expect(code?.label).toContain('ชั้น 2 ห้อง NK2217');
    expect(parseRoomCode('nk6301')?.place.id).toBe('classroom-2');
  });

  it('ignores unknown buildings and other text', () => {
    expect(parseRoomCode('NK9999')).toBeNull();
    expect(parseRoomCode('ห้อง 204')).toBeNull();
    expect(parseRoomCode('NK22170')).toBeNull();
  });
});

// สคริปต์ npm run place อ่านพิกัดจากลิงก์ Google Maps ที่ผู้ใช้คัดลอกมา
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { parseMapsLink, isOnCampus } = require('../scripts/maps-link.cjs');

describe('parseMapsLink', () => {
  it('prefers the place pin (!3d !4d) over the map view (@)', () => {
    const link =
      'https://www.google.com/maps/place/%E0%B8%AD%E0%B8%B2%E0%B8%84%E0%B8%B2%E0%B8%A3+2/@17.8029299,102.7487299,17.75z/data=!4m6!3m5!8m2!3d17.8023886!4d102.7478689!16s';
    expect(parseMapsLink(link)).toEqual({ latitude: 17.802389, longitude: 102.747869, name: 'อาคาร 2', source: 'place' });
  });

  it('falls back to the map view and rejects links without coordinates', () => {
    expect(parseMapsLink('https://www.google.com/maps/@17.8045,102.7473,17z')).toMatchObject({ latitude: 17.8045, source: 'view' });
    expect(parseMapsLink('https://example.com')).toBeNull();
  });

  it('knows whether a point is on campus', () => {
    expect(isOnCampus({ latitude: 17.802389, longitude: 102.747869 })).toBe(true);
    expect(isOnCampus({ latitude: 13.7563, longitude: 100.5018 })).toBe(false);
  });
});
