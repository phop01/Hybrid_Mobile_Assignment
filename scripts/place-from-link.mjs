// แก้/หาพิกัดอาคารจากลิงก์ Google Maps
//
// วิธีใช้:
//   npm run place -- "<ลิงก์ Google Maps>"            → พิมพ์พิกัด + บรรทัด JSON ไว้คัดลอกเพิ่มอาคารใหม่
//   npm run place -- "<ลิงก์ Google Maps>" <id>       → แก้พิกัดของอาคาร id นั้นใน src/data/campus-places.json ให้เลย
//
// เอาลิงก์มาจากไหน: เปิด Google Maps → แตะอาคาร (ให้ขึ้นชื่ออาคาร) → แชร์ → คัดลอกลิงก์ (ลิงก์สั้น maps.app.goo.gl ก็ได้)
// ไม่ได้ดึงข้อมูลแผนที่ของ Google มาทั้งก้อน อ่านแค่พิกัดที่อยู่ในลิงก์ที่ผู้ใช้คัดลอกเอง

import { readFileSync, writeFileSync } from 'node:fs';

import mapsLink from './maps-link.cjs';

const { parseMapsLink, isOnCampus, distanceMeters } = mapsLink;
const DATA_FILE = new URL('../src/data/campus-places.json', import.meta.url);

/** ลิงก์สั้น (maps.app.goo.gl) → ตาม redirect ไปหาลิงก์เต็มที่มีพิกัด */
async function expand(link) {
  if (!/^https?:\/\/(maps\.app\.goo\.gl|goo\.gl)\//.test(link)) return link;
  let url = link;
  for (let i = 0; i < 5; i++) {
    const res = await fetch(url, { redirect: 'manual' });
    const next = res.headers.get('location');
    if (!next) break;
    url = new URL(next, url).toString();
    if (/!3d|@\d/.test(url)) break;
  }
  return url;
}

async function main() {
  const [link, id] = process.argv.slice(2);
  if (!link) {
    console.log('วิธีใช้: npm run place -- "<ลิงก์ Google Maps>" [id อาคาร]');
    process.exit(1);
  }
  const point = parseMapsLink(await expand(link));
  if (!point) {
    console.error('ไม่พบพิกัดในลิงก์นี้ ลองแตะที่อาคารใน Google Maps ให้ขึ้นชื่อก่อน แล้วค่อยคัดลอกลิงก์');
    process.exit(1);
  }
  if (!isOnCampus(point)) {
    console.error(`พิกัด ${point.latitude}, ${point.longitude} อยู่นอกวิทยาเขต (ไกลเกิน 1.5 กม.) ตรวจลิงก์อีกครั้ง`);
    process.exit(1);
  }
  const precision = point.source === 'place' ? 'หมุดสถานที่ (แม่น)' : 'กลางจอแผนที่ (แม่นน้อยกว่า ควรแตะอาคารก่อนคัดลอกลิงก์)';
  console.log(`${point.name ?? 'สถานที่'}: ${point.latitude}, ${point.longitude} · ${precision}`);

  const places = JSON.parse(readFileSync(DATA_FILE, 'utf8'));
  if (!id) {
    console.log('\nเพิ่มเป็นอาคารใหม่: คัดลอกบรรทัดนี้ไปใส่ใน src/data/campus-places.json แล้วแก้ id/shortName/kind');
    console.log(
      JSON.stringify({ id: 'new-place', name: point.name ?? 'ชื่ออาคาร', shortName: point.name ?? 'ชื่อสั้น', kind: 'building', latitude: point.latitude, longitude: point.longitude }),
    );
    return;
  }
  const place = places.find((p) => p.id === id);
  if (!place) {
    console.error(`ไม่พบอาคาร id "${id}" มี: ${places.map((p) => p.id).join(', ')}`);
    process.exit(1);
  }
  const moved = Math.round(distanceMeters(place, point));
  place.latitude = point.latitude;
  place.longitude = point.longitude;
  // เขียนกลับแบบหนึ่งอาคารต่อหนึ่งบรรทัด ให้อ่าน/เทียบ diff ง่าย
  writeFileSync(DATA_FILE, `[\n${places.map((p) => `  ${JSON.stringify(p).replace(/,"/g, ', "').replace(/":/g, '": ')}`).join(',\n')}\n]\n`);
  console.log(`แก้ "${place.name}" แล้ว (ย้าย ${moved} ม.) · ถ้า server เปิดอยู่ ให้ npm run reset-data แล้วเปิดใหม่เพื่อให้ข้อมูลตัวอย่างย้ายตาม`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
