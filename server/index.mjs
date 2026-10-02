// KKUNK Today API server
// ใช้ Node.js ล้วน (node:http) ไม่ต้องติดตั้ง package เพิ่ม เพื่อให้ clone แล้วรันได้ทันที
//
// เหตุผลที่ต้องมี server กลาง:
// - ที่นั่งคงเหลือต้องเห็นตรงกันทุกคน
// - ผลเช็กอินต้องถูกเก็บไว้ที่ที่ผู้จัดตรวจได้ และ server คำนวณระยะทางเองจากพิกัดที่ส่งมา
//   (ไม่เชื่อค่าระยะที่แอปคำนวณ เพราะแอปถูกแก้ไขได้)

import { createServer } from 'node:http';
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync, createReadStream } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildActivities, buildBroadcasts, SEED_USERS, hoursBetween } from './seed.mjs';
import { isExpoPushToken, pushMessages, sendPush } from './push.mjs';
import { effectiveUser, rolesOf, ROLES } from './roles.mjs';
import { registerBroadcastRoutes } from './broadcasts.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(HERE, '.data');
const DB_FILE = join(DATA_DIR, 'db.json');
const UPLOAD_DIR = join(DATA_DIR, 'uploads');
// โปสเตอร์ตัวอย่างที่อยู่ใน repo (สร้างด้วย npm run posters) ไม่ถูกลบตอน reset-data
const POSTER_DIR = join(HERE, 'demo-posters');

export const PORT = Number(process.env.API_PORT ?? 3001);
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
const MAX_EXTRA_PHOTOS = 5;
const MAX_ACTIVITY_HOURS = 12;

// ---------- ฐานข้อมูล (ไฟล์ JSON) ----------

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const candidate = scryptSync(password, salt, 32);
  return timingSafeEqual(candidate, Buffer.from(hash, 'hex'));
}

function loadDb() {
  mkdirSync(UPLOAD_DIR, { recursive: true });
  let saved = { registrations: [], sessions: [], users: [], customActivities: [], announcements: [] };
  if (existsSync(DB_FILE)) {
    try {
      saved = JSON.parse(readFileSync(DB_FILE, 'utf8'));
    } catch {
      // ไม่เริ่มฐานข้อมูลว่างทับของเดิม: สำรองไฟล์ที่เสียไว้ แล้วหยุด ให้คนแก้/ลบเองก่อน
      const backup = `${DB_FILE}.broken-${Date.now()}`;
      copyFileSync(DB_FILE, backup);
      console.error(`[api] อ่าน db.json ไม่ได้ สำรองไว้ที่ ${backup} (ลบ server/.data/db.json หรือ npm run reset-data เพื่อเริ่มใหม่)`);
      process.exit(1);
    }
  }
  return buildDb(saved);
}

/** สร้างข้อมูลใน memory จากที่บันทึกไว้ (ส่ง {} = เริ่มใหม่จากข้อมูลตัวอย่างล้วน) */
function buildDb(saved) {
  // กิจกรรมที่ผู้จัดสร้างเองในแอป ต้องเก็บถาวร
  const customActivities = Array.isArray(saved.customActivities) ? saved.customActivities : [];
  // บัญชีที่สมัครเองในแอป (บัญชีตัวอย่างสร้างใหม่ทุกครั้ง ไม่ต้องเก็บ)
  const registeredUsers = Array.isArray(saved.users) ? saved.users : [];
  return {
    // กิจกรรมตัวอย่างสร้างใหม่ทุกครั้งที่เปิด server เพื่อให้เวลาเป็นปัจจุบันเสมอ
    activities: [...buildActivities(), ...customActivities],
    customActivities,
    users: [
      ...SEED_USERS.map(({ password, ...user }) => ({ ...user, passwordHash: hashPassword(password) })),
      ...registeredUsers.filter((u) => !SEED_USERS.some((d) => d.studentId === u.studentId)),
    ],
    registeredUsers,
    registrations: Array.isArray(saved.registrations) ? saved.registrations : [],
    sessions: Array.isArray(saved.sessions) ? saved.sessions : [],
    // ประกาศที่ผู้จัดส่งถึงผู้ลงทะเบียน แอปนักศึกษาดึงไปแสดงเป็นแจ้งเตือนในเครื่อง
    announcements: Array.isArray(saved.announcements) ? saved.announcements : [],
    // ประกาศทั่ววิทยาเขตจากเจ้าหน้าที่ เช่น ปิดน้ำ ปิดถนน
    broadcasts: Array.isArray(saved.broadcasts) ? saved.broadcasts : buildBroadcasts(),
    // กล่องแจ้งเตือนของทุกคน: server ตัดสินว่าใครควรรู้เรื่องอะไร แอปแค่ดึงของตัวเองไปเด้ง
    notifications: Array.isArray(saved.notifications) ? saved.notifications : [],
    // Expo push token ของเครื่องที่ login อยู่ (ผูกกับ session: logout แล้วลบ ไม่เด้งหาคนที่ออกไปแล้ว)
    pushTokens: Array.isArray(saved.pushTokens) ? saved.pushTokens : [],
  };
}

const db = loadDb();

const MAX_NOTIFICATIONS = 1000;

function persist() {
  if (db.notifications.length > MAX_NOTIFICATIONS) db.notifications = db.notifications.slice(-MAX_NOTIFICATIONS);
  const { registrations, sessions, customActivities, registeredUsers, announcements, broadcasts, notifications, pushTokens } = db;
  // เขียนลงไฟล์ชั่วคราวแล้ว rename: ถ้า process ตายกลางทาง db.json เดิมยังอยู่ครบ
  const tmp = `${DB_FILE}.tmp`;
  writeFileSync(
    tmp,
    JSON.stringify(
      { registrations, sessions, customActivities, users: registeredUsers, announcements, broadcasts, notifications, pushTokens },
      null,
      2,
    ),
  );
  renameSync(tmp, DB_FILE);
}

/**
 * ใส่แจ้งเตือนลงกล่องของผู้ใช้ (แอปที่เปิดอยู่ poll GET /me/inbox) และส่ง push ให้เครื่องที่ลงทะเบียนไว้ (เด้งแม้ปิดแอป)
 * kind + targetId บอกแอปว่าแตะแล้วต้องเปิดหน้าไหน payload เก็บแค่ ID ไม่เก็บข้อมูลส่วนตัว
 */
function notify(userIds, { kind, targetId, title, body }) {
  const createdAt = new Date().toISOString();
  const recipients = new Set([...userIds].filter(Boolean));
  for (const userId of recipients) {
    db.notifications.push({ id: randomUUID(), userId, kind, targetId, title, body, createdAt });
  }
  const tokens = [...new Set(db.pushTokens.filter((t) => recipients.has(t.userId)).map((t) => t.token))];
  sendPush(pushMessages(tokens, { kind, targetId, title, body }), (dead) => {
    db.pushTokens = db.pushTokens.filter((t) => t.token !== dead);
    persist();
  });
}

/**
 * เก็บเฉพาะ hash ของ token ในไฟล์ฐานข้อมูล: ถ้าไฟล์หลุด ก็เอา token ไปใช้เข้าระบบไม่ได้
 * (token สุ่ม 256 บิต จึงใช้ SHA-256 ธรรมดาได้ ไม่ต้องช้าแบบรหัสผ่าน)
 */
function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

/** สร้าง session ใหม่ (และล้าง session ที่หมดอายุไปแล้วทิ้ง ไม่ให้ไฟล์โตเรื่อย ๆ) */
function startSession(user) {
  const now = Date.now();
  db.sessions = db.sessions.filter((s) => s.expiresAt > now && typeof s.tokenHash === 'string');
  const token = randomBytes(32).toString('hex');
  const expiresAt = now + TOKEN_TTL_MS;
  const session = { tokenHash: hashToken(token), userId: user.id, expiresAt, activeRole: rolesOf(user)[0] };
  db.sessions.push(session);
  return { token, expiresAt: new Date(expiresAt).toISOString(), session };
}


// ---------- helpers ----------

class HttpError extends Error {
  /** fields: ข้อความผิดพลาดรายช่องของฟอร์ม (ใช้กับ 400 validation_failed) */
  constructor(status, code, message, fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

/** ข้อมูลในฟอร์มไม่ผ่าน: โยนเมื่อมี error อย่างน้อยหนึ่งช่อง */
function assertValid(errors) {
  if (Object.keys(errors).length > 0) throw new HttpError(400, 'validation_failed', 'ข้อมูลไม่ถูกต้อง', errors);
}

function send(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(body === undefined ? '' : JSON.stringify(body));
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_PHOTO_BYTES * 1.5) throw new HttpError(413, 'too_large', 'ข้อมูลที่ส่งมีขนาดใหญ่เกินไป');
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  let body;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'invalid_json', 'รูปแบบข้อมูลไม่ถูกต้อง');
  }
  // null / ตัวเลข / array ผ่าน JSON.parse ได้ แต่ทุก route คาดว่าเป็น object
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'invalid_json', 'รูปแบบข้อมูลไม่ถูกต้อง');
  }
  return body;
}

function distanceMeters(a, b) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** การลงทะเบียนที่ยังนับที่นั่ง (ไม่นับที่ยกเลิก/ไม่ได้รับอนุมัติ) */
function activeRegistrations(activityId) {
  return db.registrations.filter((r) => r.activityId === activityId && r.status !== 'cancelled' && r.status !== 'rejected');
}

/** เหตุผลจากเจ้าหน้าที่ 3–200 ตัวอักษร (ไม่ครบ → null) */
function reasonText(value) {
  const note = typeof value === 'string' ? value.trim() : '';
  return note.length >= 3 && note.length <= 200 ? note : null;
}

function publicActivity(activity) {
  const { baseRegistered, ...rest } = activity;
  const organizer = db.users.find((u) => u.id === activity.organizerId);
  return {
    imageUrl: null,
    ...rest,
    organizerName: organizer?.fullName ?? 'ผู้จัดกิจกรรม',
    registeredCount: baseRegistered + activeRegistrations(activity.id).length,
  };
}

/** สรุปตัวเลขสำหรับผู้จัด: ลงทะเบียน เข้าร่วมแล้ว รอตรวจ */
function organizerStats(activity) {
  const list = activeRegistrations(activity.id);
  return {
    registered: list.length,
    checkedIn: list.filter((r) => r.status === 'checked_in').length,
    pendingReview: list.filter((r) => r.status === 'pending_review').length,
  };
}

function findActivity(id) {
  const activity = db.activities.find((a) => a.id === id);
  if (!activity) throw new HttpError(404, 'activity_not_found', 'ไม่พบกิจกรรมนี้');
  return activity;
}

function publicUser(user) {
  const { passwordHash, ...rest } = user;
  return rest;
}

function publicRegistration(registration) {
  const { idempotencyKey, userId, ...rest } = registration;
  return { reviewNote: null, ...rest };
}

/** session ของ request นี้จาก header "Authorization: Bearer <token>" (undefined ถ้าไม่มี/หมดอายุ) */
function getSession(req) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return undefined;
  const tokenHash = hashToken(token);
  const session = db.sessions.find((s) => s.tokenHash === tokenHash);
  return session && session.expiresAt >= Date.now() ? session : undefined;
}

function requireUser(req) {
  const session = getSession(req);
  const user = session && db.users.find((u) => u.id === session.userId);
  if (!user) throw new HttpError(401, 'unauthorized', 'กรุณาเข้าสู่ระบบใหม่');
  return effectiveUser(user, session.activeRole);
}

/** หน้าที่ของผู้จัดต้องตรวจ role ที่ server เสมอ การซ่อนปุ่มในแอปอย่างเดียวไม่พอ */
function requireOrganizer(user) {
  if (user.role !== 'organizer') throw new HttpError(403, 'forbidden', 'เฉพาะผู้จัดกิจกรรมเท่านั้น');
  return user;
}

const DEPARTMENT_LABEL = { activities: 'งานกิจกรรมนักศึกษา' };

/** เจ้าหน้าที่กิจกรรม (activities) = สร้างกิจกรรม/ตรวจหลักฐาน/ประกาศ ตรวจที่ server ทุกครั้ง */
function requireStaff(user, department) {
  requireOrganizer(user);
  if (user.department !== department) {
    throw new HttpError(403, 'forbidden', `เฉพาะเจ้าหน้าที่${DEPARTMENT_LABEL[department]}`);
  }
  return user;
}

function findOwnActivity(organizer, id) {
  const activity = findActivity(id);
  if (activity.organizerId !== organizer.id) throw new HttpError(403, 'forbidden', 'คุณไม่ใช่ผู้จัดกิจกรรมนี้');
  return activity;
}

function findOwnRegistration(user, id) {
  const registration = db.registrations.find((r) => r.id === id);
  // ไม่บอกว่ามีอยู่จริงถ้าไม่ใช่ของผู้ใช้คนนี้ เพื่อไม่ให้เดา ID ของคนอื่นได้
  if (!registration || registration.userId !== user.id) {
    throw new HttpError(404, 'registration_not_found', 'ไม่พบการลงทะเบียนนี้');
  }
  return registration;
}

// ---------- validation (ซ้ำกับฝั่งแอป เพราะ client ถูกแก้ไขได้) ----------

function validateRegistrationBody(body) {
  const errors = {};
  if (typeof body.fullName !== 'string' || body.fullName.trim().length < 2) errors.fullName = 'กรุณากรอกชื่อ-นามสกุล';
  if (typeof body.studentId !== 'string' || !/^\d{10}$/.test(body.studentId)) errors.studentId = 'รหัสนักศึกษาต้องเป็นตัวเลข 10 หลัก';
  if (typeof body.faculty !== 'string' || body.faculty.trim().length < 2) errors.faculty = 'กรุณากรอกคณะ';
  if (typeof body.phone !== 'string' || !/^0\d{9}$/.test(body.phone)) errors.phone = 'เบอร์โทรต้องขึ้นต้นด้วย 0 และมี 10 หลัก';
  if (body.dietary !== undefined && (typeof body.dietary !== 'string' || body.dietary.length > 200)) {
    errors.dietary = 'ข้อจำกัดด้านอาหารยาวเกินไป';
  }
  return errors;
}

const CATEGORIES = ['academic', 'volunteer', 'sport', 'culture'];

function validateActivityBody(body) {
  const errors = {};
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (title.length < 5 || title.length > 100) errors.title = 'ชื่อกิจกรรมต้องยาว 5–100 ตัวอักษร';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  if (description.length < 10 || description.length > 1000) errors.description = 'รายละเอียดต้องยาว 10–1000 ตัวอักษร';
  if (!CATEGORIES.includes(body.category)) errors.category = 'ประเภทกิจกรรมไม่ถูกต้อง';
  const start = Date.parse(body.startsAt);
  const end = Date.parse(body.endsAt);
  if (!Number.isFinite(start) || start < Date.now() - 60 * 60 * 1000) errors.startsAt = 'เวลาเริ่มต้องไม่อยู่ในอดีต';
  if (!Number.isFinite(end) || end <= start) errors.endsAt = 'เวลาจบต้องหลังเวลาเริ่ม';
  else if (end - start > MAX_ACTIVITY_HOURS * 60 * 60 * 1000) errors.endsAt = `กิจกรรมยาวได้ไม่เกิน ${MAX_ACTIVITY_HOURS} ชั่วโมงต่อวัน`;
  const loc = body.location ?? {};
  if (typeof loc.name !== 'string' || loc.name.trim().length < 2) errors.locationName = 'กรุณาระบุชื่อสถานที่';
  if (!Number.isFinite(loc.latitude) || !Number.isFinite(loc.longitude) || Math.abs(loc.latitude) > 90 || Math.abs(loc.longitude) > 180) {
    errors.location = 'กรุณาปักหมุดสถานที่บนแผนที่';
  }
  if (!Number.isInteger(loc.radiusM) || loc.radiusM < 30 || loc.radiusM > 1000) errors.radiusM = 'รัศมีเช็กอินต้องอยู่ระหว่าง 30–1000 เมตร';
  if (!['app', 'paper'].includes(body.checkInMethod)) errors.checkInMethod = 'วิธีเช็กชื่อไม่ถูกต้อง';
  if (!Number.isInteger(body.capacity) || body.capacity < 1 || body.capacity > 2000) errors.capacity = 'จำนวนรับต้องเป็น 1–2000 คน';
  return errors;
}

/**
 * เก็บรูป JPEG (base64) ลงโฟลเดอร์ uploads คืน path สำหรับเปิดรูป
 * ตรวจขนาดและ magic number ของ JPEG เอง ไม่เชื่อแค่สิ่งที่ client บอก
 */
function saveJpeg(base64, fileName, label) {
  if (typeof base64 !== 'string' || base64.length < 100) throw new HttpError(400, 'photo_invalid', `ไฟล์${label}ไม่ถูกต้อง`);
  const photo = Buffer.from(base64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
  if (photo.length > MAX_PHOTO_BYTES) throw new HttpError(413, 'photo_too_large', `${label}ใหญ่เกิน 3 MB`);
  if (photo[0] !== 0xff || photo[1] !== 0xd8) throw new HttpError(400, 'photo_invalid', `${label}ต้องเป็นไฟล์ JPEG`);
  writeFileSync(join(UPLOAD_DIR, fileName), photo);
  return `/uploads/${fileName}`;
}

/** รูปที่ไม่บังคับแนบ (รูปปก/โปสเตอร์): ไม่ส่งมา = null */
function saveOptionalJpeg(base64, fileName, label) {
  return base64 === undefined || base64 === null || base64 === '' ? null : saveJpeg(base64, fileName, label);
}

/** ส่งไฟล์รูปจากโฟลเดอร์ (ชื่อไฟล์ผ่าน regex แล้ว จึงออกนอกโฟลเดอร์ไม่ได้) */
function serveJpeg(res, dir, name, cacheControl) {
  const file = join(dir, name);
  if (!existsSync(file)) throw new HttpError(404, 'not_found', 'ไม่พบรูป');
  const stream = createReadStream(file);
  // ไฟล์หายระหว่างอ่าน → ตอบ 404 แทนที่ error จะทำให้ server ล่ม
  stream.on('error', () => {
    if (!res.headersSent) send(res, 404, { code: 'not_found', message: 'ไม่พบรูป' });
    else res.destroy();
  });
  stream.once('open', () => {
    res.writeHead(200, {
      'Content-Type': 'image/jpeg',
      'Access-Control-Allow-Origin': '*',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': cacheControl,
    });
    stream.pipe(res);
  });
}

// ---------- กันเดารหัสผ่าน: ผิด 5 ครั้งติด ล็อก 60 วินาที ----------

const LOGIN_LOCK_AFTER = 5;
const LOGIN_LOCK_MS = 60 * 1000;
const loginFailures = new Map(); // loginId → { count, lockedUntil }

// ---------- token ผู้ดูแล (ล้างข้อมูลตอน server เปิดอยู่) ----------
// สุ่มใหม่ทุกครั้งที่เปิด server เขียนลงไฟล์ใน server/.data ให้ scripts/reset-live.mjs อ่าน
// ไม่เชื่อ IP ของผู้เรียก เพราะคำขอที่ผ่าน tunnel ก็มาจาก localhost เหมือนกัน

const ADMIN_TOKEN = randomBytes(24).toString('hex');

export function adminTokenFile(port) {
  return join(DATA_DIR, `admin-token-${port}`);
}

function isAdminToken(value) {
  if (typeof value !== 'string') return false;
  const given = Buffer.from(value);
  const expected = Buffer.from(ADMIN_TOKEN);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

function checkLoginLock(loginId) {
  const entry = loginFailures.get(loginId);
  if (entry && entry.lockedUntil > Date.now()) {
    const seconds = Math.ceil((entry.lockedUntil - Date.now()) / 1000);
    throw new HttpError(429, 'too_many_attempts', `ใส่รหัสผ่านผิดหลายครั้ง ลองใหม่ใน ${seconds} วินาที`);
  }
}

function recordLoginFailure(loginId) {
  const entry = loginFailures.get(loginId) ?? { count: 0, lockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= LOGIN_LOCK_AFTER) {
    entry.count = 0;
    entry.lockedUntil = Date.now() + LOGIN_LOCK_MS;
  }
  loginFailures.set(loginId, entry);
}

// ---------- routes ----------

async function handle(req, res) {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  const parts = url.pathname.split('/').filter(Boolean);
  const method = req.method ?? 'GET';

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization,Idempotency-Key',
    });
    return res.end();
  }

  // GET /health
  if (method === 'GET' && url.pathname === '/health') {
    return send(res, 200, { ok: true });
  }

  // GET /uploads/:file (รูปหลักฐานเช็กอิน)
  if (method === 'GET' && parts[0] === 'uploads' && parts.length === 2 && /^[\w-]+\.jpg$/.test(parts[1])) {
    // รูปหลักฐาน/รูปปัญหา: ให้เก็บ cache เฉพาะในเครื่องผู้ใช้ ไม่ให้ proxy กลางเก็บ
    return serveJpeg(res, UPLOAD_DIR, parts[1], 'private, max-age=3600');
  }

  // GET /posters/:file (โปสเตอร์ตัวอย่างของกิจกรรม/ประกาศ ไม่ใช่ข้อมูลส่วนตัว cache ได้)
  if (method === 'GET' && parts[0] === 'posters' && parts.length === 2 && /^[\w-]+\.jpg$/.test(parts[1])) {
    return serveJpeg(res, POSTER_DIR, parts[1], 'public, max-age=86400');
  }

  // POST /auth/register (สมัครสมาชิก เลือกบทบาทเดียว: นักศึกษา / เจ้าหน้าที่กิจกรรม / เจ้าหน้าที่อาคาร)
  if (method === 'POST' && url.pathname === '/auth/register') {
    const body = await readJson(req);
    const errors = {};
    const roles = body.roles === undefined ? ['student'] : body.roles;
    if (!Array.isArray(roles) || roles.length !== 1 || !ROLES.includes(roles[0])) {
      errors.roles = 'เลือกบทบาท 1 บทบาท';
    }
    const staff = Array.isArray(roles) && roles.some((r) => r !== 'student');
    if (typeof body.studentId !== 'string' || !/^\d{10}$/.test(body.studentId)) {
      errors.studentId = `${staff ? 'รหัสนักศึกษา/บุคลากร' : 'รหัสนักศึกษา'}ต้องเป็นตัวเลข 10 หลัก`;
    }
    if (typeof body.fullName !== 'string' || body.fullName.trim().length < 4 || body.fullName.length > 80) {
      errors.fullName = 'กรุณากรอกชื่อ-นามสกุล';
    }
    if (typeof body.faculty !== 'string' || body.faculty.trim().length < 2 || body.faculty.length > 100) {
      errors.faculty = staff ? 'กรุณากรอกคณะ/หน่วยงาน' : 'กรุณากรอกคณะ';
    }
    if (typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 100) {
      errors.password = 'รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร';
    }
    assertValid(errors);
    if (db.users.some((u) => u.studentId === body.studentId)) {
      return send(res, 409, { code: 'already_exists', message: 'รหัสนี้มีบัญชีอยู่แล้ว', fields: { studentId: 'รหัสนี้มีบัญชีอยู่แล้ว เข้าสู่ระบบแทน' } });
    }
    // เรียงตามลำดับมาตรฐาน บทบาทแรกคือบทบาทที่ใช้ตอนเข้าระบบ
    const ordered = ROLES.filter((r) => roles.includes(r));
    const user = {
      id: randomUUID(),
      studentId: body.studentId,
      fullName: body.fullName.trim(),
      faculty: body.faculty.trim(),
      roles: ordered,
      passwordHash: hashPassword(body.password),
    };
    db.users.push(user);
    db.registeredUsers.push(user);
    const { session, ...auth } = startSession(user);
    persist();
    return send(res, 201, { ...auth, user: publicUser(effectiveUser(user, session.activeRole)) });
  }

  // POST /auth/login
  if (method === 'POST' && url.pathname === '/auth/login') {
    const body = await readJson(req);
    const loginId = typeof body.studentId === 'string' ? body.studentId : '';
    checkLoginLock(loginId);
    const user = db.users.find((u) => u.studentId === body.studentId);
    // ข้อความเดียวกันทั้งกรณีไม่มีผู้ใช้และรหัสผิด เพื่อไม่บอกว่ารหัสนักศึกษาไหนมีอยู่
    if (!user || typeof body.password !== 'string' || !verifyPassword(body.password, user.passwordHash)) {
      recordLoginFailure(loginId);
      throw new HttpError(401, 'invalid_credentials', 'รหัสหรือรหัสผ่านไม่ถูกต้อง');
    }
    loginFailures.delete(loginId);
    const { session, ...auth } = startSession(user);
    persist();
    return send(res, 200, { ...auth, user: publicUser(effectiveUser(user, session.activeRole)) });
  }

  // POST /auth/logout
  if (method === 'POST' && url.pathname === '/auth/logout') {
    const ended = getSession(req);
    db.sessions = db.sessions.filter((s) => s !== ended);
    // ออกจากระบบ = เครื่องนี้ไม่ควรได้แจ้งเตือนของบัญชีนี้อีก
    if (ended) db.pushTokens = db.pushTokens.filter((t) => t.sessionHash !== ended.tokenHash);
    persist();
    return send(res, 204);
  }

  // POST /admin/reset (header x-admin-token): กลับเป็นข้อมูลตัวอย่างล้วน ทุก session ถูกล้าง ต้อง login ใหม่
  // เรียกจากคอมที่รัน server เท่านั้น (npm run reset-live อ่าน token จากไฟล์) ไม่มีในแอป
  // token ผิด/ไม่มี ตอบ 404 เหมือนไม่มี endpoint นี้
  if (method === 'POST' && url.pathname === '/admin/reset') {
    if (!isAdminToken(req.headers['x-admin-token'])) throw new HttpError(404, 'not_found', 'ไม่พบ endpoint นี้');
    Object.assign(db, buildDb({}));
    loginFailures.clear();
    rmSync(UPLOAD_DIR, { recursive: true, force: true });
    mkdirSync(UPLOAD_DIR, { recursive: true });
    persist();
    return send(res, 204);
  }

  // POST /me/role { role }: เปลี่ยนบทบาทที่ใช้อยู่ (ต้องเป็นบทบาทที่บัญชีมี) มีผลกับ session นี้
  if (method === 'POST' && url.pathname === '/me/role') {
    const user = requireUser(req);
    const body = await readJson(req);
    if (!user.roles.includes(body.role)) throw new HttpError(403, 'forbidden', 'บัญชีนี้ไม่มีบทบาทนี้');
    // อ่าน session ใหม่หลัง await: ถ้า logout ไประหว่างนั้นให้ตอบ 401 ไม่ใช่ 500
    const session = getSession(req);
    if (!session) throw new HttpError(401, 'unauthorized', 'กรุณาเข้าสู่ระบบใหม่');
    session.activeRole = body.role;
    persist();
    return send(res, 200, publicUser(effectiveUser(db.users.find((u) => u.id === user.id), body.role)));
  }

  // POST /me/push-token (เครื่องนี้รับ push ของบัญชีนี้) · DELETE (เลิกรับ)
  if (url.pathname === '/me/push-token' && (method === 'POST' || method === 'DELETE')) {
    const user = requireUser(req);
    const sessionHash = getSession(req).tokenHash;
    const body = await readJson(req);
    if (!isExpoPushToken(body.token)) throw new HttpError(400, 'invalid_push_token', 'push token ไม่ถูกต้อง');
    // เครื่องหนึ่งผูกกับบัญชีเดียว: login บัญชีอื่นบนเครื่องเดิม → ย้ายไปบัญชีใหม่
    db.pushTokens = db.pushTokens.filter((t) => t.token !== body.token);
    if (method === 'POST') db.pushTokens.push({ userId: user.id, token: body.token, sessionHash, createdAt: new Date().toISOString() });
    persist();
    return send(res, 200, { ok: true });
  }

  // GET /me
  if (method === 'GET' && url.pathname === '/me') {
    return send(res, 200, publicUser(requireUser(req)));
  }

  // GET /activities
  if (method === 'GET' && url.pathname === '/activities') {
    const list = [...db.activities].sort((a, b) => a.startsAt.localeCompare(b.startsAt)).map(publicActivity);
    return send(res, 200, list);
  }

  // POST /activities (ผู้จัดสร้างกิจกรรม)
  if (method === 'POST' && url.pathname === '/activities') {
    const organizer = requireStaff(requireUser(req), 'activities');
    const body = await readJson(req);
    assertValid(validateActivityBody(body));
    const id = randomUUID();
    const activity = {
      id,
      title: body.title.trim(),
      description: body.description.trim(),
      category: body.category,
      startsAt: new Date(body.startsAt).toISOString(),
      endsAt: new Date(body.endsAt).toISOString(),
      location: {
        name: body.location.name.trim(),
        latitude: body.location.latitude,
        longitude: body.location.longitude,
        radiusM: body.location.radiusM,
      },
      checkInMethod: body.checkInMethod,
      capacity: body.capacity,
      baseRegistered: 0,
      organizerId: organizer.id,
      hours: hoursBetween(body.startsAt, body.endsAt),
      imageUrl: saveOptionalJpeg(body.coverBase64, `cover-${id}.jpg`, 'รูปปก'),
    };
    db.activities.push(activity);
    db.customActivities.push(activity);
    persist();
    return send(res, 201, publicActivity(activity));
  }

  // GET /organizer/activities (กิจกรรมที่ฉันจัด + ตัวเลขสรุป)
  if (method === 'GET' && url.pathname === '/organizer/activities') {
    const organizer = requireStaff(requireUser(req), 'activities');
    const list = db.activities
      .filter((a) => a.organizerId === organizer.id)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .map((a) => ({ ...publicActivity(a), stats: organizerStats(a) }));
    return send(res, 200, list);
  }

  // GET /activities/:id/attendees (ผู้จัดของกิจกรรมนั้นเท่านั้น)
  if (method === 'GET' && parts[0] === 'activities' && parts[2] === 'attendees' && parts.length === 3) {
    const organizer = requireStaff(requireUser(req), 'activities');
    const activity = findOwnActivity(organizer, parts[1]);
    // ส่งทุกสถานะ (รวมไม่รับ/ยกเลิก) ให้ผู้จัดกรองดูเองได้ ต่างจาก activeRegistrations ที่ใช้นับที่นั่ง
    const list = db.registrations
      .filter((r) => r.activityId === activity.id)
      .sort((a, b) => a.registeredAt.localeCompare(b.registeredAt))
      .map(publicRegistration);
    return send(res, 200, list);
  }

  // GET/POST /activities/:id/announcements
  // ผู้จัดส่งประกาศ (เช่น "เริ่มกิจกรรมแล้ว") → แอปนักศึกษาที่ลงทะเบียนไว้ดึงไปเด้งแจ้งเตือน
  if (parts[0] === 'activities' && parts[2] === 'announcements' && parts.length === 3) {
    if (method === 'GET') {
      requireUser(req);
      const activity = findActivity(parts[1]);
      const list = db.announcements
        .filter((a) => a.activityId === activity.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return send(res, 200, list);
    }
    if (method === 'POST') {
      const organizer = requireStaff(requireUser(req), 'activities');
      const activity = findOwnActivity(organizer, parts[1]);
      const body = await readJson(req);
      const message = typeof body.message === 'string' ? body.message.trim() : '';
      if (message.length < 1 || message.length > 200) {
        const error = 'ข้อความต้องยาว 1–200 ตัวอักษร';
        throw new HttpError(400, 'validation_failed', error, { message: error });
      }
      const announcement = { id: randomUUID(), activityId: activity.id, message, createdAt: new Date().toISOString() };
      db.announcements.push(announcement);
      notify(
        activeRegistrations(activity.id).map((r) => r.userId),
        { kind: 'activity', targetId: activity.id, title: `ประกาศ: ${activity.title}`, body: message },
      );
      persist();
      return send(res, 201, announcement);
    }
  }

  // GET /announcements (ประกาศของกิจกรรมที่ฉันลงทะเบียนไว้ ใหม่สุดก่อน)
  if (method === 'GET' && url.pathname === '/announcements') {
    const user = requireUser(req);
    const mine = new Set(
      db.registrations
        .filter((r) => r.userId === user.id && r.status !== 'cancelled' && r.status !== 'rejected')
        .map((r) => r.activityId),
    );
    const list = db.announcements
      .filter((a) => mine.has(a.activityId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 50);
    return send(res, 200, list);
  }

  // GET /activities/:id
  if (method === 'GET' && parts[0] === 'activities' && parts.length === 2) {
    return send(res, 200, publicActivity(findActivity(parts[1])));
  }

  // POST /activities/:id/registrations
  if (method === 'POST' && parts[0] === 'activities' && parts[2] === 'registrations' && parts.length === 3) {
    const user = requireUser(req);
    if (user.role === 'organizer') throw new HttpError(403, 'forbidden', 'บัญชีผู้จัดลงทะเบียนเข้าร่วมกิจกรรมไม่ได้');
    const activity = findActivity(parts[1]);
    const body = await readJson(req);
    const idempotencyKey = req.headers['idempotency-key'];

    // ส่งซ้ำด้วย key เดิม (เช่น เน็ตหลุดแล้วกดลองใหม่) → คืนผลเดิม ไม่สร้างรายการใหม่
    if (idempotencyKey) {
      const previous = db.registrations.find((r) => r.idempotencyKey === idempotencyKey && r.userId === user.id);
      if (previous) return send(res, 200, publicRegistration(previous));
    }

    assertValid(validateRegistrationBody(body));
    if (activity.cancelledAt) throw new HttpError(409, 'activity_cancelled', 'กิจกรรมนี้ถูกยกเลิกแล้ว');
    if (new Date(activity.endsAt).getTime() < Date.now()) {
      throw new HttpError(409, 'activity_ended', 'กิจกรรมนี้จบไปแล้ว');
    }
    if (db.registrations.some((r) => r.activityId === activity.id && r.userId === user.id && r.status === 'rejected')) {
      throw new HttpError(409, 'registration_rejected', 'เจ้าหน้าที่ไม่รับการลงทะเบียนของคุณในกิจกรรมนี้');
    }
    if (activeRegistrations(activity.id).some((r) => r.userId === user.id)) {
      throw new HttpError(409, 'already_registered', 'คุณลงทะเบียนกิจกรรมนี้แล้ว');
    }
    if (publicActivity(activity).registeredCount >= activity.capacity) {
      throw new HttpError(409, 'activity_full', 'กิจกรรมนี้เต็มแล้ว');
    }

    const registration = {
      id: randomUUID(),
      activityId: activity.id,
      userId: user.id,
      status: 'registered',
      registeredAt: new Date().toISOString(),
      form: {
        fullName: body.fullName.trim(),
        studentId: body.studentId,
        faculty: body.faculty.trim(),
        phone: body.phone,
        dietary: (body.dietary ?? '').trim(),
      },
      checkIn: null,
      idempotencyKey: typeof idempotencyKey === 'string' ? idempotencyKey : undefined,
    };
    db.registrations.push(registration);
    persist();
    return send(res, 201, publicRegistration(registration));
  }

  // GET /registrations (ของฉัน)
  if (method === 'GET' && url.pathname === '/registrations') {
    const user = requireUser(req);
    const list = db.registrations
      .filter((r) => r.userId === user.id)
      .sort((a, b) => b.registeredAt.localeCompare(a.registeredAt))
      .map(publicRegistration);
    return send(res, 200, list);
  }

  // GET /registrations/:id
  if (method === 'GET' && parts[0] === 'registrations' && parts.length === 2) {
    const user = requireUser(req);
    return send(res, 200, publicRegistration(findOwnRegistration(user, parts[1])));
  }

  // DELETE /registrations/:id (ยกเลิก)
  if (method === 'DELETE' && parts[0] === 'registrations' && parts.length === 2) {
    const user = requireUser(req);
    const registration = findOwnRegistration(user, parts[1]);
    if (registration.status !== 'registered') {
      const reason =
        registration.status === 'rejected'
          ? 'การลงทะเบียนนี้ไม่ได้รับอนุมัติอยู่แล้ว'
          : registration.status === 'cancelled'
            ? 'การลงทะเบียนนี้ถูกยกเลิกไปแล้ว'
            : 'ยกเลิกไม่ได้ เพราะส่งหลักฐานการเข้าร่วมไปแล้ว';
      throw new HttpError(409, 'cannot_cancel', reason);
    }
    registration.status = 'cancelled';
    persist();
    return send(res, 200, publicRegistration(registration));
  }

  // POST /registrations/:id/check-in
  if (method === 'POST' && parts[0] === 'registrations' && parts[2] === 'check-in' && parts.length === 3) {
    const user = requireUser(req);
    const registration = findOwnRegistration(user, parts[1]);
    const activity = findActivity(registration.activityId);
    const body = await readJson(req);

    if (registration.status !== 'registered') {
      // ส่งซ้ำจากคิวออฟไลน์ → ถือว่าสำเร็จแล้ว
      if (registration.checkIn) return send(res, 200, publicRegistration(registration));
      throw new HttpError(409, 'not_registered', 'การลงทะเบียนนี้ถูกยกเลิกแล้ว');
    }
    if (activity.cancelledAt) throw new HttpError(409, 'activity_cancelled', 'กิจกรรมนี้ถูกยกเลิกแล้ว');
    const { photoBase64, latitude, longitude, takenAt } = body;
    // คิวออฟไลน์รุ่นเก่าไม่มีช่องนี้ = ถ่ายสด
    const photoSource = body.photoSource === 'library' ? 'library' : 'camera';
    if (typeof photoBase64 !== 'string' || photoBase64.length < 100) {
      throw new HttpError(400, 'photo_required', 'ต้องมีรูปถ่ายเป็นหลักฐาน');
    }
    // ไม่บังคับตำแหน่งและเวลา (ผู้ใช้ตัดสินใจ แชทที่ 3): บันทึกไว้ให้เจ้าหน้าที่ดูประกอบการตรวจ
    const hasLocation = Number.isFinite(latitude) && Number.isFinite(longitude);
    const distance = hasLocation ? distanceMeters({ latitude, longitude }, activity.location) : null;
    // เวลาที่ถ่ายรูปผิดรูปแบบหรืออยู่ในอนาคต → ใช้เวลาที่ส่งแทน
    let taken = new Date(takenAt).getTime();
    if (!Number.isFinite(taken) || taken > Date.now() + 2 * 60 * 1000) taken = Date.now();

    const photoUrl = saveJpeg(photoBase64, `${registration.id}.jpg`, 'รูป');
    registration.checkIn = {
      photoUrl,
      photoSource,
      latitude: hasLocation ? latitude : null,
      longitude: hasLocation ? longitude : null,
      distanceM: distance === null ? null : Math.round(distance),
      extraPhotos: [],
      takenAt: new Date(taken).toISOString(),
      submittedAt: new Date().toISOString(),
      verifiedAt: null,
    };

    registration.reviewNote = null;
    // ทุกกิจกรรม: เจ้าหน้าที่เป็นคนตรวจรูปแล้วกดผ่าน/ไม่ผ่านเอง (แชทที่ 3 ไม่ตรวจตำแหน่ง/เวลาแล้ว จึงไม่ผ่านอัตโนมัติ)
    registration.status = 'pending_review';
    notify([activity.organizerId], {
      kind: 'manage',
      targetId: activity.id,
      title: 'มีหลักฐานการเข้าร่วมรอตรวจ',
      body: `${registration.form.fullName} · ${activity.title}`,
    });
    persist();
    return send(res, 200, publicRegistration(registration));
  }

  // POST /registrations/:id/photos (แนบรูปหลักฐานเพิ่มหลังส่งแล้ว สูงสุด MAX_EXTRA_PHOTOS รูป)
  // DELETE /registrations/:id/photos/:file: ลบรูปที่แนบเพิ่ม (ถ่ายผิด) รูปหลักที่ส่งเป็นหลักฐานลบไม่ได้
  if (method === 'DELETE' && parts[0] === 'registrations' && parts[2] === 'photos' && parts.length === 4) {
    const user = requireUser(req);
    const registration = findOwnRegistration(user, parts[1]);
    const extras = registration.checkIn?.extraPhotos ?? [];
    const photoUrl = `/uploads/${parts[3]}`;
    if (!extras.includes(photoUrl)) throw new HttpError(404, 'not_found', 'ไม่พบรูปนี้ (รูปหลักลบไม่ได้)');
    registration.checkIn.extraPhotos = extras.filter((u) => u !== photoUrl);
    rmSync(join(UPLOAD_DIR, parts[3]), { force: true });
    persist();
    return send(res, 200, publicRegistration(registration));
  }

  if (method === 'POST' && parts[0] === 'registrations' && parts[2] === 'photos' && parts.length === 3) {
    const user = requireUser(req);
    const registration = findOwnRegistration(user, parts[1]);
    const body = await readJson(req);
    // ตรวจสถานะหลังอ่าน body เสร็จ: ระหว่างรออัปโหลด ผู้จัดอาจตรวจไม่ผ่านไปแล้ว หรืออีกคำขอแนบรูปครบแล้ว
    if (!registration.checkIn || (registration.status !== 'pending_review' && registration.status !== 'checked_in')) {
      throw new HttpError(409, 'not_submitted', 'ส่งหลักฐานการเข้าร่วมก่อน แล้วค่อยแนบรูปเพิ่ม');
    }
    const extras = registration.checkIn.extraPhotos ?? [];
    if (extras.length >= MAX_EXTRA_PHOTOS) throw new HttpError(409, 'too_many_photos', `แนบรูปเพิ่มได้ไม่เกิน ${MAX_EXTRA_PHOTOS} รูป`);
    if (typeof body.photoBase64 !== 'string' || body.photoBase64.length < 100) {
      throw new HttpError(400, 'photo_required', 'ต้องมีรูปถ่าย');
    }
    const photoUrl = saveJpeg(body.photoBase64, `${registration.id}-${randomUUID().slice(0, 8)}.jpg`, 'รูป');
    registration.checkIn.extraPhotos = [...extras, photoUrl];
    persist();
    return send(res, 200, publicRegistration(registration));
  }

  // POST /registrations/:id/review (ผู้จัดตรวจหลักฐานใบเซ็นชื่อ)
  if (method === 'POST' && parts[0] === 'registrations' && parts[2] === 'review' && parts.length === 3) {
    const organizer = requireStaff(requireUser(req), 'activities');
    const registration = db.registrations.find((r) => r.id === parts[1]);
    if (!registration) throw new HttpError(404, 'registration_not_found', 'ไม่พบการลงทะเบียนนี้');
    findOwnActivity(organizer, registration.activityId);
    const body = await readJson(req);
    if (registration.status !== 'pending_review') {
      throw new HttpError(409, 'not_pending', 'รายการนี้ไม่ได้รอตรวจแล้ว (อาจตรวจไปแล้ว)');
    }
    if (body.approve === true) {
      registration.status = 'checked_in';
      registration.checkIn.verifiedAt = new Date().toISOString();
      registration.reviewNote = null;
    } else if (body.approve === false) {
      const note = typeof body.note === 'string' ? body.note.trim() : '';
      if (note.length < 3 || note.length > 200) {
        throw new HttpError(400, 'validation_failed', 'กรุณาระบุเหตุผล', { note: 'กรุณาระบุเหตุผลที่ไม่ผ่าน' });
      }
      // ไม่ผ่าน → กลับไปสถานะลงทะเบียน นักศึกษาส่งหลักฐานใหม่ได้ (ถ้ายังอยู่ในเวลางาน)
      registration.status = 'registered';
      registration.checkIn = null;
      registration.reviewNote = note;
    } else {
      throw new HttpError(400, 'invalid_decision', 'ต้องระบุว่าผ่านหรือไม่ผ่าน');
    }
    const reviewed = findActivity(registration.activityId);
    notify([registration.userId], {
      kind: 'registration',
      targetId: registration.id,
      ...(body.approve
        ? { title: 'ตรวจหลักฐานผ่านแล้ว ✓', body: `${reviewed.title} ถูกนับเป็นชั่วโมงกิจกรรมแล้ว (+${reviewed.hours} ชม.)` }
        : { title: 'หลักฐานไม่ผ่าน กรุณาส่งใหม่', body: `${reviewed.title}: ${registration.reviewNote}` }),
    });
    persist();
    return send(res, 200, publicRegistration(registration));
  }

  // POST /registrations/:id/reject (เจ้าหน้าที่ไม่รับการลงทะเบียนของนักศึกษาคนนี้ พร้อมเหตุผล)
  if (method === 'POST' && parts[0] === 'registrations' && parts[2] === 'reject' && parts.length === 3) {
    const organizer = requireStaff(requireUser(req), 'activities');
    const registration = db.registrations.find((r) => r.id === parts[1]);
    if (!registration) throw new HttpError(404, 'registration_not_found', 'ไม่พบการลงทะเบียนนี้');
    const activity = findOwnActivity(organizer, registration.activityId);
    if (registration.status !== 'registered' && registration.status !== 'pending_review') {
      throw new HttpError(409, 'cannot_reject', 'รายการนี้ไม่อยู่ในสถานะที่ไม่รับได้แล้ว');
    }
    const note = reasonText((await readJson(req)).note);
    if (!note) throw new HttpError(400, 'validation_failed', 'กรุณาระบุเหตุผล', { note: 'กรุณาระบุเหตุผล' });
    registration.status = 'rejected';
    registration.reviewNote = note;
    notify([registration.userId], {
      kind: 'registration',
      targetId: registration.id,
      title: 'การลงทะเบียนไม่ได้รับอนุมัติ',
      body: `${activity.title}: ${note}`,
    });
    persist();
    return send(res, 200, publicRegistration(registration));
  }

  // POST /activities/:id/cancel (เจ้าหน้าที่ยกเลิกทั้งกิจกรรม แจ้งทุกคนที่ลงทะเบียน)
  if (method === 'POST' && parts[0] === 'activities' && parts[2] === 'cancel' && parts.length === 3) {
    const organizer = requireStaff(requireUser(req), 'activities');
    const activity = findOwnActivity(organizer, parts[1]);
    if (activity.cancelledAt) throw new HttpError(409, 'activity_cancelled', 'กิจกรรมนี้ถูกยกเลิกไปแล้ว');
    if (new Date(activity.endsAt).getTime() < Date.now()) throw new HttpError(409, 'activity_ended', 'กิจกรรมนี้จบไปแล้ว');
    const note = reasonText((await readJson(req)).note);
    if (!note) throw new HttpError(400, 'validation_failed', 'กรุณาระบุเหตุผล', { note: 'กรุณาระบุเหตุผล' });
    activity.cancelledAt = new Date().toISOString();
    activity.cancelReason = note;
    const affected = db.registrations.filter(
      (r) => r.activityId === activity.id && (r.status === 'registered' || r.status === 'pending_review'),
    );
    for (const r of affected) {
      r.status = 'cancelled';
      r.reviewNote = `กิจกรรมถูกยกเลิก: ${note}`;
    }
    // คนที่เข้าร่วมแล้ว (checked_in) ยกเลิกกลางงาน: เก็บชั่วโมงไว้ แต่ต้องได้รู้ว่ากิจกรรมถูกยกเลิก
    const checkedIn = db.registrations.filter((r) => r.activityId === activity.id && r.status === 'checked_in');
    notify(
      [...affected, ...checkedIn].map((r) => r.userId),
      { kind: 'activity', targetId: activity.id, title: 'กิจกรรมถูกยกเลิก', body: `${activity.title}: ${note}` },
    );
    persist();
    return send(res, 200, publicActivity(activity));
  }

  // ประกาศ / กล่องแจ้งเตือน (แยกไฟล์ server/broadcasts.mjs)
  if (await broadcastRoutes(req, res, { url, parts, method })) return;

  throw new HttpError(404, 'not_found', 'ไม่พบ endpoint นี้');
}

const broadcastRoutes = registerBroadcastRoutes({
  db,
  notify,
  persist,
  send,
  readJson,
  HttpError,
  requireUser,
  requireOrganizer,
  saveOptionalJpeg,
  publicUserName: (id) => db.users.find((u) => u.id === id)?.fullName ?? null,
});

export function startServer(port = PORT) {
  const server = createServer((req, res) => {
    handle(req, res).catch((error) => {
      if (error instanceof HttpError) {
        send(res, error.status, { code: error.code, message: error.message, ...(error.fields ? { fields: error.fields } : {}) });
      } else {
        console.error('[api]', error);
        send(res, 500, { code: 'server_error', message: 'เกิดข้อผิดพลาดที่ server' });
      }
    });
  });
  writeFileSync(adminTokenFile(port), ADMIN_TOKEN);
  server.listen(port, '0.0.0.0', () => {
    console.log(`[api] KKUNK Today API พร้อมที่ http://localhost:${port}`);
  });
  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  startServer();
}
