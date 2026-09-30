// smoke test ของ API ส่วนแจ้งซ่อม/ประกาศ/กล่องแจ้งเตือน
// วิธีใช้: เปิด server ก่อน (npm run api หรือ npm start) แล้วรัน npm run smoke
// สคริปต์สร้างเรื่องทดสอบของตัวเองจริงในฐานข้อมูล ล้างได้ด้วย npm run reset-data
// รันซ้ำภายใน 10 นาทีจะติดจำกัด 5 เรื่องต่อ 10 นาที (ตั้งใจไว้) ให้ reset-data ก่อนรันใหม่
const BASE = process.env.API_URL ?? 'http://localhost:3001';
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 1)]).toString('base64');
let pass = 0;
let fail = 0;
const check = (name, ok, extra = '') => {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${ok ? '' : extra}`);
};
async function call(method, path, token, body, headers = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}
const login = async (id, pw) => (await call('POST', '/auth/login', null, { studentId: id, password: pw })).body.token;

// นักศึกษาคนที่ 1 สมัครใหม่ทุกครั้ง (บัญชีตัวอย่างนักศึกษามีคนเดียว คือ s2)
const s1 = (
  await call('POST', '/auth/register', null, { studentId: `66${String(Date.now()).slice(-8)}`, fullName: 'ทดสอบ นักศึกษา', faculty: 'คณะสหวิทยาการ', password: 'test12345' })
).body.token;
const s2 = await login('6609876543', 'campus1234');
const staff = await login('1000000002', 'organizer1234');
const org = await login('1000000001', 'organizer1234');
const since = new Date(Date.now() - 1000).toISOString();

// ---- แจ้งซ่อม ----
let r = await call('POST', '/tickets', s1, { kind: 'repair', category: 'electric', title: 'ไฟ', location: {} });
check('validation 400', r.status === 400 && r.body.fields.title && r.body.fields.photo, JSON.stringify(r.body));
const repairBody = {
  kind: 'repair',
  category: 'electric',
  title: 'ปลั๊กไฟห้อง 101 ช็อต',
  detail: 'มีประกายไฟ',
  location: { name: 'ห้อง 101', latitude: 17.8091, longitude: 102.7498 },
  photoBase64: JPEG,
};
r = await call('POST', '/tickets', s1, repairBody, { 'Idempotency-Key': 'k-1' });
check('create repair 201', r.status === 201, JSON.stringify(r.body));
const repair = r.body;
r = await call('POST', '/tickets', s1, repairBody, { 'Idempotency-Key': 'k-1' });
check('idempotent 200 same id', r.status === 200 && r.body.id === repair.id);
r = await call('POST', `/tickets/${repair.id}/follow`, s2);
check('follow', r.status === 200 && r.body.following && r.body.followerCount === 1);
r = await call('POST', `/tickets/${repair.id}/accept`, s2);
check('student accept repair 403', r.status === 403);
r = await call('GET', `/me/inbox?since=${since}`, staff);
check('facilities staff got new repair', r.body.some((n) => n.targetId === repair.id && n.kind === 'ticket'), JSON.stringify(r.body));
r = await call('GET', `/me/inbox?since=${since}`, org);
check('activities staff not notified of repair', !r.body.some((n) => n.targetId === repair.id));
r = await call('POST', `/tickets/${repair.id}/accept`, org);
check('activities staff accept repair 403', r.status === 403);
const appt = new Date(Date.now() + 3 * 3600e3).toISOString();
r = await call('POST', `/tickets/${repair.id}/accept`, staff, { appointmentAt: appt });
check('staff accept', r.status === 200 && r.body.status === 'accepted' && r.body.appointmentAt);
r = await call('POST', `/tickets/${repair.id}/accept`, staff);
check('second accept 409', r.status === 409);
r = await call('POST', `/tickets/${repair.id}/done`, staff, { note: 'เปลี่ยนปลั๊กแล้ว' });
check('done without photo (optional)', r.status === 200 && r.body.status === 'done' && r.body.afterPhotoUrl === null);
r = await call('POST', `/tickets/${repair.id}/reopen`, s1, { note: 'ยังมีกลิ่นไหม้' });
check('reopen', r.status === 200 && r.body.status === 'accepted');
r = await call('POST', `/tickets/${repair.id}/done`, staff, { photoBase64: JPEG });
check('done with after photo', r.status === 200 && r.body.afterPhotoUrl);
r = await call('POST', `/tickets/${repair.id}/confirm`, s2);
check('non-reporter confirm 403', r.status === 403);
r = await call('POST', `/tickets/${repair.id}/confirm`, s1);
check('confirm', r.status === 200 && r.body.status === 'confirmed' && r.body.events.length >= 6);
r = await call('GET', `/me/inbox?since=${since}`, s2);
check('follower got updates', r.body.filter((n) => n.targetId === repair.id).length >= 3, JSON.stringify(r.body.map((n) => n.title)));

// ---- ขอความช่วยเหลือถูกเอาออกแล้ว ----
const since2 = new Date().toISOString();
r = await call('POST', '/tickets', s1, {
  kind: 'help',
  category: 'escort',
  title: 'ข้อเท้าพลิก ช่วยพาไปห้องพยาบาล',
  location: { name: 'สนามบาส', latitude: 17.81, longitude: 102.751 },
});
check('help kind rejected 400', r.status === 400 && r.body.fields.kind, JSON.stringify(r.body));
r = await call('POST', '/me/presence', s2, { helper: true, latitude: 17.8095, longitude: 102.7505 });
check('presence endpoint removed 404', r.status === 404);

// ---- ประกาศ ----
r = await call('POST', '/broadcasts', s1, { message: 'ทดสอบประกาศ', location: { name: 'x', latitude: 1, longitude: 1 }, hours: 2 });
check('student broadcast 403', r.status === 403);
const bLoc = { name: 'หน้าหอพัก', latitude: 17.806, longitude: 102.746 };
r = await call('POST', '/broadcasts', staff, { message: 'ปิดถนนหน้าหอพักชั่วคราว', location: bLoc, hours: 3 });
check('broadcast without poster 201', r.status === 201 && r.body.imageUrl === null, JSON.stringify(r.body));
r = await call('POST', '/broadcasts', org, { message: 'ตลาดนัดนักศึกษาเย็นนี้', location: bLoc, hours: 3, posterBase64: JPEG });
check('broadcast with poster 201', r.status === 201 && /^\/uploads\/broadcast-.+\.jpg$/.test(r.body.imageUrl ?? ''), JSON.stringify(r.body));
const posterRes = await fetch(BASE + r.body.imageUrl);
check('poster image served', posterRes.status === 200 && posterRes.headers.get('content-type') === 'image/jpeg');
r = await call('POST', '/broadcasts', org, { message: 'โปสเตอร์ไม่ใช่ JPEG', location: bLoc, hours: 3, posterBase64: Buffer.alloc(200, 7).toString('base64') });
check('non-JPEG poster 400', r.status === 400);
const demoPoster = await fetch(BASE + '/posters/demo-hackathon.jpg');
check('demo poster served', demoPoster.status === 200 && demoPoster.headers.get('content-type') === 'image/jpeg');
r = await call('GET', '/activities', s1);
const seeded = r.body.filter((a) => a.imageUrl?.startsWith('/posters/'));
check('seed activities have poster covers', seeded.length === 8, `${seeded.length}`);
r = await call('GET', `/me/inbox?since=${since2}`, s1);
check('everyone got broadcast', r.body.some((n) => n.kind === 'broadcast'));
r = await call('GET', '/broadcasts', s1);
check('list broadcasts', r.status === 200 && r.body.length >= 1);
r = await call('GET', '/tickets', s1);
check('list tickets', r.status === 200 && r.body.length >= 4);
r = await call('GET', '/tickets', null);
check('tickets need login 401', r.status === 401);

// ---- หน่วยงานเจ้าหน้าที่ ----
r = await call('POST', '/activities', staff, { title: 'x' });
check('facilities staff create activity 403', r.status === 403);
r = await call('GET', '/organizer/activities', staff);
check('facilities staff manage list 403', r.status === 403);

// ---- ความปลอดภัย ----
r = await call('GET', '/tickets/nope-123', s1);
check('unknown ticket 404', r.status === 404);

const start = new Date(Date.now() + 2 * 3600e3);
r = await call('POST', '/activities', org, {
  title: 'กิจกรรมทดสอบการสร้าง',
  description: 'ใช้ทดสอบว่าเจ้าหน้าที่กิจกรรมสร้างกิจกรรมได้',
  category: 'academic',
  startsAt: start.toISOString(),
  endsAt: new Date(start.getTime() + 3600e3).toISOString(),
  location: { name: 'ห้องทดสอบ', latitude: 17.8066, longitude: 102.7463, radiusM: 100 },
  checkInMethod: 'app',
  capacity: 10,
});
check('organizer creates activity', r.status === 201, JSON.stringify(r.body));
r = await call('POST', '/demo/activities/mobile-dev-seminar/relocate', s1, { latitude: 17.8066, longitude: 102.7463 });
check('no relocate shortcut (404)', r.status === 404);

const spam = { kind: 'repair', category: 'other', title: 'ทดสอบส่งถี่ ๆ', location: { name: 'ลานกิจกรรม', latitude: 17.8, longitude: 102.74 }, photoBase64: JPEG };
const statuses = [];
for (let i = 0; i < 6; i++) statuses.push((await call('POST', '/tickets', s2, spam)).status);
check('rate limit 429 after 5', statuses.slice(0, 5).every((s) => s === 201) && statuses[5] === 429, statuses.join(','));

// ---- push notification (เด้งแม้ปิดแอป) ----
const { isExpoPushToken, pushMessages, chunk } = await import('../server/push.mjs');
check('push token format', isExpoPushToken('ExponentPushToken[abc-123]') && !isExpoPushToken('abc') && !isExpoPushToken('ExponentPushToken[<x>]'));
const [msg] = pushMessages(['ExponentPushToken[a]'], { kind: 'ticket', targetId: 't1', title: 'หัวข้อ', body: 'รายละเอียด' });
check('push payload routes like local notification', msg.data.type === 'inbox' && msg.data.kind === 'ticket' && msg.data.targetId === 't1' && msg.sound === 'default');
check('push batches of 100', chunk(Array.from({ length: 250 }, (_, i) => i)).map((c) => c.length).join(',') === '100,100,50');
r = await call('POST', '/me/push-token', null, { token: 'ExponentPushToken[smoke]' });
check('push token needs login 401', r.status === 401);
r = await call('POST', '/me/push-token', s1, { token: 'not-a-token' });
check('invalid push token 400', r.status === 400);
r = await call('POST', '/me/push-token', s1, { token: 'ExponentPushToken[smoke-test]' });
check('register push token 200', r.status === 200);
// ลบทิ้งทันที ไม่ให้แจ้งเตือนถัดไปยิง token ปลอมไปที่ Expo
r = await call('DELETE', '/me/push-token', s1, { token: 'ExponentPushToken[smoke-test]' });
check('unregister push token 200', r.status === 200);

// ---- บทบาท: สมัครได้บทบาทเดียว ----
r = await call('GET', '/me', s1);
check('student account has one role', r.body.role === 'student' && r.body.roles?.length === 1, JSON.stringify(r.body));
r = await call('POST', '/me/role', s2, { role: 'facilities' });
check('cannot switch to a role you do not have 403', r.status === 403);
r = await call('POST', '/auth/register', null, { studentId: `8${String(Date.now()).slice(-9)}`, fullName: 'บุคลากร สองบทบาท', faculty: 'งานกิจการนักศึกษา', password: 'test12345', roles: ['activities', 'student'] });
check('sign up with two roles 400', r.status === 400 && r.body.fields?.roles, JSON.stringify(r.body));
r = await call('POST', '/auth/register', null, { studentId: `8${String(Date.now()).slice(-9)}`, fullName: 'บุคลากร งานกิจกรรม', faculty: 'งานกิจการนักศึกษา', password: 'test12345', roles: ['activities'] });
check('sign up as activities staff', r.status === 201 && r.body.user?.roles?.join(',') === 'activities', JSON.stringify(r.body));
r = await call('GET', '/organizer/activities', r.body.token);
check('new staff account works as activities staff', r.status === 200);
r = await call('POST', '/auth/register', null, { studentId: '7000000001', fullName: 'ทดสอบ ผิด', faculty: 'ไม่มี', password: 'test12345', roles: [] });
check('sign up without role 400', r.status === 400 && r.body.fields?.roles);
r = await call('POST', '/demo/session', null, { as: 'student' });
check('no demo login endpoint 404', r.status === 404);

// ---- หลักฐานการเข้าร่วม: ไม่ตรวจตำแหน่ง/เวลา + แนบรูปเพิ่ม ----
r = await call('GET', '/activities', s1);
const openActivity = r.body.find((a) => a.checkInMethod === 'app' && a.registeredCount < a.capacity && Date.parse(a.endsAt) > Date.now());
r = await call('POST', `/activities/${openActivity.id}/registrations`, s1, { fullName: 'ทดสอบ นักศึกษา', studentId: '6600000000', faculty: 'คณะสหวิทยาการ', phone: '0812345678', dietary: '' });
const myReg = r.body.id;
r = await call('POST', `/registrations/${myReg}/photos`, s1, { photoBase64: JPEG });
check('extra photo before submitting 409', r.status === 409);
r = await call('POST', `/registrations/${myReg}/check-in`, s1, { photoBase64: JPEG, photoSource: 'library', latitude: null, longitude: null, takenAt: '2020-01-01T00:00:00Z' });
check('check-in without location, any time → waits for staff', r.status === 200 && r.body.status === 'pending_review' && r.body.checkIn.distanceM === null, JSON.stringify(r.body));
r = await call('POST', `/registrations/${myReg}/photos`, s1, { photoBase64: JPEG });
check('add extra evidence photo', r.status === 200 && r.body.checkIn.extraPhotos.length === 1, JSON.stringify(r.body));
r = await call('POST', `/registrations/${myReg}/photos`, s2, { photoBase64: JPEG });
check('cannot add photo to another user registration 404', r.status === 404, String(r.status));

// ---- เจ้าหน้าที่: ตรวจหลักฐาน / ไม่รับการลงทะเบียน / ยกเลิกกิจกรรม ----
r = await call('POST', `/registrations/${myReg}/review`, org, { approve: true });
check('staff approves evidence → checked_in', r.status === 200 && r.body.status === 'checked_in', JSON.stringify(r.body));
const s3 = (
  await call('POST', '/auth/register', null, { studentId: `67${String(Date.now()).slice(-8)}`, fullName: 'ทดสอบ ไม่รับ', faculty: 'คณะสหวิทยาการ', password: 'test12345' })
).body.token;
r = await call('POST', `/activities/${openActivity.id}/registrations`, s3, { fullName: 'ทดสอบ ไม่รับ', studentId: '6700000000', faculty: 'คณะสหวิทยาการ', phone: '0812345678', dietary: '' });
const regToReject = r.body.id;
r = await call('POST', `/registrations/${regToReject}/reject`, s3, { note: 'ไม่รับตัวเอง' });
check('student cannot reject registration 403', r.status === 403, String(r.status));
r = await call('POST', `/registrations/${regToReject}/reject`, staff, { note: 'ไม่ใช่งานของฉัน' });
check('facilities staff cannot reject registration 403', r.status === 403, String(r.status));
r = await call('POST', `/registrations/${regToReject}/reject`, org, { note: 'x' });
check('reject without reason 400', r.status === 400, String(r.status));
r = await call('POST', `/registrations/${regToReject}/reject`, org, { note: 'คุณสมบัติไม่ตรงกับกิจกรรม' });
check('staff rejects registration', r.status === 200 && r.body.status === 'rejected' && r.body.reviewNote === 'คุณสมบัติไม่ตรงกับกิจกรรม', JSON.stringify(r.body));
r = await call('POST', `/activities/${openActivity.id}/registrations`, s3, { fullName: 'ทดสอบ ไม่รับ', studentId: '6700000000', faculty: 'คณะสหวิทยาการ', phone: '0812345678', dietary: '' });
check('rejected student cannot register again 409', r.status === 409, String(r.status));
r = await call('GET', '/me/inbox?since=', s3);
check('rejected student notified', (r.body.items ?? r.body).some((i) => i.title === 'การลงทะเบียนไม่ได้รับอนุมัติ'));
r = await call('POST', '/activities', org, {
  title: 'กิจกรรมทดสอบยกเลิก', description: 'ทดสอบการยกเลิกกิจกรรมทั้งกิจกรรม', category: 'academic',
  startsAt: new Date(Date.now() + 3600e3).toISOString(), endsAt: new Date(Date.now() + 7200e3).toISOString(),
  location: { name: 'ห้อง 101', latitude: 17.87, longitude: 102.72, radiusM: 100 }, checkInMethod: 'app', capacity: 20,
});
const toCancel = r.body.id;
r = await call('POST', `/activities/${toCancel}/registrations`, s3, { fullName: 'ทดสอบ ไม่รับ', studentId: '6700000000', faculty: 'คณะสหวิทยาการ', phone: '0812345678', dietary: '' });
const cancelledReg = r.body.id;
r = await call('POST', `/activities/${toCancel}/cancel`, s3, { note: 'นักศึกษายกเลิกเอง' });
check('student cannot cancel activity 403', r.status === 403, String(r.status));
r = await call('POST', `/activities/${toCancel}/cancel`, org, { note: 'วิทยากรติดภารกิจ' });
check('staff cancels activity', r.status === 200 && !!r.body.cancelledAt && r.body.cancelReason === 'วิทยากรติดภารกิจ', JSON.stringify(r.body));
r = await call('GET', `/registrations/${cancelledReg}`, s3);
check('registrations of cancelled activity become cancelled', r.body.status === 'cancelled', JSON.stringify(r.body));
r = await call('POST', `/activities/${toCancel}/registrations`, s1, { fullName: 'ทดสอบ นักศึกษา', studentId: '6600000000', faculty: 'คณะสหวิทยาการ', phone: '0812345678', dietary: '' });
check('cannot register for cancelled activity 409', r.status === 409, String(r.status));
r = await call('GET', '/me/inbox?since=', s3);
check('registrants notified of cancellation', (r.body.items ?? r.body).some((i) => i.title === 'กิจกรรมถูกยกเลิก'));

r = await call('POST', '/auth/logout', s2);
r = await call('GET', '/me', s2);
check('token revoked after logout 401', r.status === 401);

// server ในเครื่องเดียวกัน: ไฟล์ฐานข้อมูลต้องไม่มี token ตรง ๆ
const { existsSync, readFileSync } = await import('node:fs');
const dbFile = new URL('../server/.data/db.json', import.meta.url);
if (existsSync(dbFile)) {
  const raw = readFileSync(dbFile, 'utf8');
  check('db.json stores no raw tokens', !raw.includes(s1) && !raw.includes(staff) && !raw.includes('"token"'));
}

// ปุ่ม "ล้างข้อมูลสาธิต": ต้อง login · ล้างทุก session · บัญชีตัวอย่างยัง login ได้และไม่มีการลงทะเบียนค้าง
r = await call('POST', '/demo/reset', null);
check('demo reset requires login 401', r.status === 401, String(r.status));
r = await call('POST', '/demo/reset', s1);
check('demo reset 204', r.status === 204, String(r.status));
r = await call('GET', '/me', s1);
check('sessions cleared after reset 401', r.status === 401, String(r.status));
const fresh = await login('6609876543', 'campus1234');
r = await call('GET', '/registrations', fresh);
check('seed account logs in with no registrations after reset', r.status === 200 && (r.body.items ?? r.body).length === 0, JSON.stringify(r.body).slice(0, 200));
r = await call('GET', '/activities', fresh);
check('seed activities rebuilt after reset', r.status === 200 && (r.body.items ?? r.body).length > 0);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
