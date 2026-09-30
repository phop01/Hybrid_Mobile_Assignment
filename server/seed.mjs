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
      id: 'demo-app-checkin',
      title: 'เปิดบ้านชมรมคอมพิวเตอร์',
      description:
        'ชมโปรเจกต์ของรุ่นพี่ ลองเล่นเกมที่ชมรมพัฒนาเอง และแนะนำการเข้าชมรม ' +
        'เช็กอินในแอปได้เมื่ออยู่ในบริเวณงานและถ่ายรูปสดเพื่อยืนยันการเข้าร่วม',
      category: 'academic',
      startsAt: at(15 * MINUTE, false),
      endsAt: at(3 * HOUR, false),
      location: at_('classroom-1', 'ลานหน้าอาคารเรียนรวมและปฏิบัติการ 1', 150, 0.0004, -0.0002),
      checkInMethod: 'app',
      capacity: 80,
      baseRegistered: 41,
    },
    {
      id: 'demo-paper-checkin',
      title: 'ค่ายอาสาพัฒนาชุมชนรอบวิทยาเขต',
      description:
        'ทาสีศาลา เก็บขยะ และปลูกผักสวนครัวร่วมกับชาวบ้าน ผู้จัดใช้ใบเซ็นชื่อแบบกระดาษ ' +
        'หลังเซ็นชื่อแล้วให้ถ่ายรูปใบเซ็นชื่อตรงบรรทัดของคุณเป็นหลักฐาน ผู้จัดตรวจแล้วจึงนับชั่วโมงจิตอาสา',
      category: 'volunteer',
      startsAt: at(-10 * MINUTE, false),
      endsAt: at(2 * HOUR, false),
      location: place('ศาลาชุมชน ต.หนองกอมเกาะ', -0.009, 0.011, 200),
      checkInMethod: 'paper',
      capacity: 40,
      baseRegistered: 22,
    },
    {
      id: 'mobile-dev-seminar',
      title: 'สัมมนา Mobile App Development ในอุตสาหกรรม',
      description: 'วิทยากรจากบริษัทพัฒนาแอปมาเล่าประสบการณ์การทำแอประดับ production และตอบคำถามเรื่องการฝึกงาน',
      category: 'academic',
      startsAt: at(2 * HOUR),
      endsAt: at(4 * HOUR),
      location: at_('classroom-1', 'ห้องประชุม ชั้น 3 อาคารเรียนรวมและปฏิบัติการ 1 (NK2301)', 120),
      checkInMethod: 'app',
      capacity: 120,
      baseRegistered: 87,
    },
    {
      id: 'futsal-friendly',
      title: 'ฟุตซอลกระชับมิตรระหว่างสาขาวิชา',
      description: 'แข่งขันฟุตซอลแบบทีมละ 5 คน เน้นสนุกและสร้างความสัมพันธ์ระหว่างสาขาวิชา มีน้ำดื่มและผ้าเย็นให้',
      category: 'sport',
      startsAt: dayAt(1, 16),
      endsAt: dayAt(1, 19),
      location: at_('gym', 'โรงยิมพลศึกษา', 150),
      checkInMethod: 'app',
      capacity: 60,
      baseRegistered: 38,
    },
    {
      id: 'ux-workshop',
      title: 'Workshop ออกแบบ UX สำหรับแอปมือถือ',
      description: 'ฝึกทำ user flow และ prototype ในเวลา 3 ชั่วโมง รับจำนวนจำกัดเพื่อให้วิทยากรดูแลได้ทั่วถึง',
      category: 'academic',
      startsAt: dayAt(2, 13),
      endsAt: dayAt(2, 16),
      location: at_('classroom-2', 'อาคารเรียนรวมและปฏิบัติการ 2 (อครใหม่) ห้อง NK6301', 120),
      checkInMethod: 'app',
      capacity: 30,
      baseRegistered: 30,
    },
    {
      id: 'thai-music-contest',
      title: 'ประกวดวงดนตรีไทยร่วมสมัย',
      description: 'ชมการประกวดวงดนตรีไทยจากทุกสาขาวิชา ผู้ชมร่วมโหวตวงยอดนิยมได้ มีการแสดงพิเศษช่วงพักกรรมการ',
      category: 'culture',
      startsAt: dayAt(5, 17, 30),
      endsAt: dayAt(5, 21),
      location: at_('library', 'ลานหน้าห้องสมุดช่อวายุภักษ์', 200),
      checkInMethod: 'paper',
      capacity: 500,
      baseRegistered: 212,
    },
    {
      id: 'tree-planting',
      title: 'ปลูกป่าเฉลิมพระเกียรติ',
      description: 'ร่วมปลูกต้นไม้บริเวณพื้นที่ป่าของวิทยาเขต แต่งกายชุดพร้อมลุย มีรถรับส่งจากหน้าหอพัก',
      category: 'volunteer',
      startsAt: dayAt(7, 7),
      endsAt: dayAt(7, 11),
      location: place('แปลงป่าชุมชน ฝั่งตะวันตก', 0.006, -0.014, 300),
      checkInMethod: 'paper',
      capacity: 150,
      baseRegistered: 64,
    },
    {
      id: 'blood-donation',
      title: 'บริจาคโลหิตประจำภาคเรียน',
      description: 'ร่วมบริจาคโลหิตกับสภากาชาดไทย ให้เลือด ให้ชีวิต',
      category: 'volunteer',
      startsAt: dayAt(-1, 9),
      endsAt: dayAt(-1, 15),
      location: at_('complex', 'คอมเพล็กซ์ (Compak NKC)', 120),
      checkInMethod: 'app',
      capacity: 200,
      baseRegistered: 143,
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
    // หน่วยงาน: activities = กิจกรรม/จิตอาสา, facilities = อาคารสถานที่ (รับงานซ่อม)
    department: 'activities',
  },
  {
    // เจ้าหน้าที่อาคารสถานที่: รับเรื่องแจ้งซ่อม
    id: 'staff2',
    studentId: '1000000002',
    password: 'organizer1234',
    fullName: 'นายช่าง ประจำอาคาร',
    faculty: 'งานอาคารสถานที่ มข. วิทยาเขตหนองคาย',
    role: 'organizer',
    department: 'facilities',
  },
];

/**
 * เรื่องแจ้งซ่อมตัวอย่าง (สร้างใหม่ทุกครั้งที่เปิด server เวลาจึงเป็นปัจจุบันเสมอ)
 * ไม่มีรูปแนบ (photoUrl: null) เพราะไม่อยากเก็บรูปตัวอย่างไว้ใน repo
 */
export function buildTickets() {
  const t = (id, fields) => ({
    id,
    photoUrl: null,
    afterPhotoUrl: null,
    assigneeId: null,
    followerIds: [],
    appointmentAt: null,
    note: null,
    ...fields,
    events: [{ at: fields.createdAt, type: 'created', byId: fields.reporterId }],
  });
  const spot = (id, name, dLat = 0, dLng = 0) => {
    const { radiusM, ...point } = at_(id, name, 0, dLat, dLng);
    return point;
  };
  return [
    t('demo-repair-light', {
      kind: 'repair',
      category: 'electric',
      title: 'ไฟทางเดินดับ หน้าอาคารเรียนรวม 1',
      detail: 'หลอดไฟทางเดินดับ 3 ดวงติดกัน ตอนค่ำมืดมาก เดินกลับหอแล้วน่ากลัว',
      location: spot('classroom-1', 'ทางเดินหน้าอาคารเรียนรวม 1 (อครเก่า)', 0.0003, 0.0002),
      status: 'open',
      reporterId: 'u2',
      createdAt: at(-26 * HOUR, false),
    }),
    t('demo-repair-water', {
      kind: 'repair',
      category: 'water',
      title: 'ก๊อกน้ำห้องน้ำชายชั้น 2 รั่ว',
      detail: 'ก๊อกอ่างล้างมือตัวที่สองจากประตูปิดไม่สนิท น้ำไหลตลอด',
      location: spot('classroom-1', 'ห้องน้ำชาย ชั้น 2 อาคารเรียนรวม 1 (อครเก่า)'),
      status: 'accepted',
      reporterId: 'u2',
      assigneeId: 'staff2',
      appointmentAt: dayAt(1, 10),
      createdAt: at(-5 * HOUR, false),
    }),
    t('demo-repair-road', {
      kind: 'repair',
      category: 'road',
      title: 'ทางเท้าหน้าคอมเพล็กซ์เป็นหลุม',
      detail: 'แผ่นปูนแตกเป็นหลุมลึก ฝนตกแล้วน้ำขัง มีคนสะดุดแล้ว',
      location: spot('complex', 'ทางเท้าหน้าคอมเพล็กซ์ (Compak NKC)', 0.0002, 0),
      status: 'open',
      reporterId: 'u2',
      createdAt: at(-50 * MINUTE, false),
    }),
  ];
}

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
      message: 'ปิดน้ำประปาอาคารเรียนรวม 1 (อครเก่า) เพื่อซ่อมท่อ 13:00–16:00 น. ขออภัยในความไม่สะดวก',
      location: point('classroom-1', 'อาคารเรียนรวม 1 (อครเก่า)'),
      imageUrl: null,
      byId: 'staff2',
      createdAt: at(-30 * MINUTE, false),
      expiresAt: at(8 * HOUR, false),
    },
  ];
}
