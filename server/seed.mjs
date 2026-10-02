// ข้อมูลตัวอย่างของ server
// เวลาของกิจกรรมคำนวณจาก "ตอนเปิด server" เพื่อให้ข้อมูลตัวอย่างเป็นปัจจุบันทุกวัน
// (ถ้าเขียนวันที่ตายตัว วันสอบกิจกรรมจะจบไปหมดแล้ว)

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

import { readFileSync } from 'node:fs';

// อาคารจริงของ มข. วิทยาเขตหนองคาย (ไฟล์เดียวกับที่แอปใช้วาดป้ายบนแผนที่)
const CAMPUS_PLACES = JSON.parse(readFileSync(new URL('../src/data/campus-places.json', import.meta.url), 'utf8'));

// กลางวิทยาเขต (ถ.มิตรภาพ ต.หนองกอมเกาะ อ.เมืองหนองคาย) ใช้กับสถานที่นอกวิทยาเขตที่ตั้งใจให้อยู่ไกล
const CAMPUS = { latitude: 17.8045, longitude: 102.7473 };

function at(offsetMs, roundTo30 = true) {
  const date = new Date(Date.now() + offsetMs);
  if (roundTo30) {
    date.setMinutes(date.getMinutes() < 30 ? 0 : 30, 0, 0);
  }
  return date.toISOString();
}

/** วันถัดไปอีก dayOffset วัน เวลา hour:minute (เวลาเครื่อง server) ใช้กับกิจกรรมล่วงหน้าให้เวลาสมจริง */
function dayAt(dayOffset, hour, minute = 0) {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

/** สถานที่ที่อาคารจริง (id จาก campus-places.json) + ชื่อจุดย่อย เลื่อนได้เล็กน้อย เช่น หน้าอาคาร */
function at_(id, name, radiusM = 120, dLat = 0, dLng = 0) {
  const building = CAMPUS_PLACES.find((p) => p.id === id);
  if (!building) throw new Error(`ไม่พบอาคาร ${id} ใน campus-places.json`);
  return {
    name,
    latitude: Number((building.latitude + dLat).toFixed(6)),
    longitude: Number((building.longitude + dLng).toFixed(6)),
    radiusM,
  };
}

function place(name, dLat, dLng, radiusM = 150) {
  return {
    name,
    latitude: Number((CAMPUS.latitude + dLat).toFixed(6)),
    longitude: Number((CAMPUS.longitude + dLng).toFixed(6)),
    radiusM,
  };
}

/** ชั่วโมงกิจกรรมที่ได้ = ระยะเวลางาน ปัดเป็นครึ่งชั่วโมง (ใช้นับชั่วโมงกิจกรรมในโปรไฟล์) */
export function hoursBetween(startsAt, endsAt) {
  const hours = (new Date(endsAt).getTime() - new Date(startsAt).getTime()) / HOUR;
  return Math.max(0.5, Math.round(hours * 2) / 2);
}

// ผู้จัดกิจกรรมตัวอย่าง: กิจกรรมทั้งหมดใน seed เป็นของบัญชีนี้ ให้ login ไปตรวจหลักฐานได้
export const SEED_ORGANIZER_ID = 'org1';

export function buildActivities() {
  return seedActivities().map((a) => ({
    ...a,
    organizerId: SEED_ORGANIZER_ID,
    hours: hoursBetween(a.startsAt, a.endsAt),
    // รูปปกตัวอย่างใน server/demo-posters (ชื่อไฟล์ = id กิจกรรม)
    imageUrl: `/posters/${a.id}.jpg`,
  }));
}

function seedActivities() {
  return [
    {
      id: 'demo-hackathon',
      title: 'NKC Hackathon 2026',
      description: 'แข่งขันเขียนโปรแกรมแก้ปัญหาโจทย์จริงรอบรั้ววิทยาเขต พร้อมรับคำแนะนำจาก Mentor แบบใกล้ชิด ส่งรูปหลักฐานการเข้าร่วมผ่านแอป',
      category: 'academic',
      startsAt: at(-15 * MINUTE, false),
      endsAt: at(4 * HOUR, false),
      location: at_('classroom-2', 'อาคารเรียนรวมและปฏิบัติการ 2 (อครใหม่) ห้อง NK6301', 120),
      checkInMethod: 'app',
      capacity: 100,
      baseRegistered: 45,
    },
    {
      id: 'demo-beach-cleanup',
      title: 'จิตอาสาทำความสะอาดหาดสีดา',
      description: 'ร่วมกันเก็บขยะและทำความสะอาดบริเวณหาดสีดา เพื่อรักษาสิ่งแวดล้อมริมฝั่งโขง ถ่ายรูปใบเซ็นชื่อเพื่อรับชั่วโมงจิตอาสา',
      category: 'volunteer',
      startsAt: dayAt(1, 8),
      endsAt: dayAt(1, 12),
      location: place('หาดสีดา ต.หนองกอมเกาะ', -0.015, 0.020, 300),
      checkInMethod: 'paper',
      capacity: 50,
      baseRegistered: 30,
    },
    {
      id: 'demo-sports-day',
      title: 'กีฬาสีเชื่อมความสัมพันธ์',
      description: 'การแข่งขันกีฬาพื้นบ้านและกีฬาสากล เพื่อเชื่อมความสัมพันธ์ระหว่างนักศึกษาทุกคณะ',
      category: 'sport',
      startsAt: dayAt(2, 16),
      endsAt: dayAt(2, 19),
      location: at_('gym', 'โรงยิมพลศึกษา', 200),
      checkInMethod: 'app',
      capacity: 200,
      baseRegistered: 180,
    },
    {
      id: 'demo-photo-exhibition',
      title: 'นิทรรศการภาพถ่ายริมโขง',
      description: 'ชมนิทรรศการภาพถ่ายวิถีชีวิตริมแม่น้ำโขงฝีมือนักศึกษา พร้อมร่วมโหวตภาพประทับใจ',
      category: 'culture',
      startsAt: dayAt(3, 10),
      endsAt: dayAt(3, 16),
      location: at_('library', 'ลานหน้าห้องสมุดช่อวายุภักษ์', 150),
      checkInMethod: 'app',
      capacity: 300,
      baseRegistered: 85,
    },
    {
      id: 'demo-ai-talk',
      title: 'AI in Everyday Life',
      description: 'สัมมนาพิเศษหัวข้อการประยุกต์ใช้ AI ในชีวิตประจำวันและการเรียนอย่างสร้างสรรค์',
      category: 'academic',
      startsAt: dayAt(4, 13),
      endsAt: dayAt(4, 16),
      location: at_('classroom-1', 'ห้องประชุม ชั้น 3 อาคารเรียนรวมและปฏิบัติการ 1 (NK2301)', 120),
      checkInMethod: 'app',
      capacity: 120,
      baseRegistered: 105,
    },
    {
      id: 'demo-music-fest',
      title: 'Music Fest @ NKC',
      description: 'เทศกาลดนตรีร็อคและป๊อปจากวงดนตรีนักศึกษา พร้อมซุ้มอาหารมากมาย',
      category: 'culture',
      startsAt: dayAt(5, 18),
      endsAt: dayAt(5, 22),
      location: at_('complex', 'ลานกิจกรรมหน้าคอมเพล็กซ์', 200),
      checkInMethod: 'app',
      capacity: 500,
      baseRegistered: 412,
    },
    {
      id: 'demo-marathon',
      title: 'NKC Mini Marathon 2026',
      description: 'วิ่งการกุศลรอบวิทยาเขตหนองคาย ระยะทาง 5 กม. และ 10 กม.',
      category: 'sport',
      startsAt: dayAt(7, 6),
      endsAt: dayAt(7, 9),
      location: at_('complex', 'จุดปล่อยตัวหน้าคอมเพล็กซ์', 200),
      checkInMethod: 'app',
      capacity: 300,
      baseRegistered: 250,
    },
    {
      id: 'demo-blood-donation',
      title: 'บริจาคโลหิต กู้วิกฤติคลังเลือด',
      description: 'ร่วมบริจาคโลหิตกับสภากาชาดไทยสาขาจังหวัดหนองคาย เพื่อช่วยเหลือผู้ป่วย',
      category: 'volunteer',
      startsAt: dayAt(10, 9),
      endsAt: dayAt(10, 15),
      location: at_('classroom-1', 'โถงชั้น 1 อาคารเรียนรวม 1 (อครเก่า)', 120),
      checkInMethod: 'paper',
      capacity: 150,
      baseRegistered: 98,
    },
  ];
}

// รหัสผ่านเก็บเป็น hash ใน server.mjs ตอนเริ่มระบบ ไม่เก็บตัวจริงในฐานข้อมูล
// บัญชีตัวอย่างของระบบ (ข้อมูลเริ่มต้น) ลบออกก่อนใช้งานจริง
export const SEED_USERS = [
  {
    id: 'u2',
    studentId: '6609876543',
    password: 'campus1234',
    fullName: 'สมหญิง รักเรียน',
    faculty: 'คณะสหวิทยาการ มข. วิทยาเขตหนองคาย',
    role: 'student',
  },
  {
    // บุคลากร: ใช้รหัสบุคลากร 10 หลักแทนรหัสนักศึกษา
    id: SEED_ORGANIZER_ID,
    studentId: '1000000001',
    password: 'organizer1234',
    fullName: 'อ.วิภา จัดเก่ง',
    faculty: 'งานกิจการนักศึกษา มข. วิทยาเขตหนองคาย',
    role: 'organizer',
    // หน่วยงาน: activities = กิจกรรม/จิตอาสา
    department: 'activities',
  },
];

/** ประกาศตัวอย่างจากเจ้าหน้าที่ (ยังไม่หมดอายุ) มีทั้งแบบข้อความล้วนและแบบมีโปสเตอร์ */
export function buildBroadcasts() {
  const point = (id, name) => (({ radiusM, ...p }) => p)(at_(id, name));
  return [
    {
      id: 'demo-broadcast-market',
      message: 'NK Market ตลาดนัดนักศึกษา 16:00–20:00 น. ลานหน้าห้องสมุด · ถนนหน้าห้องสมุดปิดชั่วคราว ใช้เส้นทางข้างอาคารเรียนรวม 2',
      location: point('library', 'ลานหน้าห้องสมุดช่อวายุภักษ์'),
      imageUrl: '/posters/demo-broadcast-market.jpg',
      byId: 'org1',
      createdAt: at(-10 * MINUTE, false),
      expiresAt: at(10 * HOUR, false),
    },
    {
      id: 'demo-broadcast-water',
      message: 'ปิดน้ำประปาอาคารเรียนรวม 1 (อครเก่า) ชั่วคราวระหว่างซ่อมท่อ ใช้ห้องน้ำอาคารเรียนรวม 2 แทน ขออภัยในความไม่สะดวก',
      location: point('classroom-1', 'อาคารเรียนรวม 1 (อครเก่า)'),
      imageUrl: null,
      byId: 'org1',
      createdAt: at(-30 * MINUTE, false),
      expiresAt: at(8 * HOUR, false),
    },
  ];
}
