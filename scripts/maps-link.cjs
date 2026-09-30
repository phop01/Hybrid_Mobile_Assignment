// แยกพิกัดและชื่อสถานที่จากลิงก์ Google Maps (ใช้ทั้งใน scripts/place-from-link.mjs และ test)
// ลิงก์ของสถานที่มีพิกัดหมุดจริงอยู่ในรูป "!3d<ละติจูด>!4d<ลองจิจูด>"
// ถ้าไม่มี (เช่น ลิงก์แค่มุมมองแผนที่) ใช้ "@<ละติจูด>,<ลองจิจูด>" ซึ่งเป็นกลางจอ แม่นน้อยกว่า

'use strict';

/** กลางวิทยาเขต มข. หนองคาย และรัศมีที่ยอมรับ (ตรงกับ src/lib/campus.ts และ test) */
const CAMPUS_CENTER = { latitude: 17.8045, longitude: 102.7473 };
const CAMPUS_RADIUS_M = 1500;

function distanceMeters(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

const round6 = (n) => Number(n.toFixed(6));

/**
 * คืน { latitude, longitude, name, source } หรือ null ถ้าไม่มีพิกัดในลิงก์
 * source = 'place' (หมุดสถานที่ แม่นที่สุด) | 'view' (กลางจอ)
 */
function parseMapsLink(link) {
  if (typeof link !== 'string') return null;
  let text = link.trim();
  try {
    text = decodeURIComponent(text);
  } catch {
    // ลิงก์ที่เข้ารหัสไม่ครบ ใช้ตามเดิม
  }
  const place = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(text);
  const view = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(text);
  const match = place ?? view;
  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  const nameMatch = /\/place\/([^/@]+)/.exec(text);
  const name = nameMatch ? nameMatch[1].replace(/\+/g, ' ').trim() : null;
  return { latitude: round6(latitude), longitude: round6(longitude), name, source: place ? 'place' : 'view' };
}

function isOnCampus(point) {
  return distanceMeters(point, CAMPUS_CENTER) <= CAMPUS_RADIUS_M;
}

module.exports = { parseMapsLink, isOnCampus, distanceMeters, CAMPUS_CENTER, CAMPUS_RADIUS_M };
