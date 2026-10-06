// smoke test ของ API: สมัคร/ล็อกอิน, กิจกรรม, ลงทะเบียน, หลักฐาน, ประกาศ, กล่องแจ้งเตือน
// วิธีใช้: เปิด server ก่อน (npm run api หรือ npm start) แล้วรัน npm run smoke
// สคริปต์สร้างข้อมูลทดสอบของตัวเองจริงในฐานข้อมูล แล้วจบด้วยการล้างข้อมูลทั้งหมด (/admin/reset)
// → อย่ารันกับ server ที่มีข้อมูลที่อยากเก็บไว้ · รันซ้ำได้เลย ไม่ต้อง reset-data
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
const org = await login('1000000001', 'organizer1234');
const since = new Date(Date.now() - 1000).toISOString();

// ---- เรื่องแจ้งซ่อม / ขอความช่วยเหลือ ถูกเอาออกแล้ว ----
let r = await call('POST', '/tickets', s1, { kind: 'repair', category: 'electric', title: 'ไฟดับ' });
check('tickets endpoint removed 404', r.status === 404, String(r.status));
r = await call('GET', '/tickets', s1);
check('tickets list removed 404', r.status === 404, String(r.status));
r = await call('POST', '/me/presence', s2, { helper: true, latitude: 17.8095, longitude: 102.7505 });
check('presence endpoint removed 404', r.status === 404);

// ---- โปรไฟล์: สาขา + รูป ----
r = await call('PUT', '/me/profile', s1, { major: 'นิติศาสตร์' });
check('set major', r.status === 200 && r.body.major === 'นิติศาสตร์', JSON.stringify(r.body));
r = await call('PUT', '/me/profile', s1, { major: 'สาขาที่ไม่มี' });
check('unknown major 400', r.status === 400 && r.body.fields?.major);
r = await call('PUT', '/me/profile', s1, { avatarBase64: Buffer.alloc(200, 7).toString('base64') });
check('non-JPEG avatar 400', r.status === 400);
r = await call('PUT', '/me/profile', s1, { avatarBase64: JPEG });
check('set avatar keeps major', r.status === 200 && /^\/uploads\/avatar-.+\.jpg\?exp=\d+&sig=[0-9a-f]{32}$/.test(r.body.avatarUrl ?? '') && r.body.major === 'นิติศาสตร์', JSON.stringify(r.body));
const avatarRes = await fetch(BASE + r.body.avatarUrl);
check('avatar image served with signature', avatarRes.status === 200);
check('avatar without signature 404', (await fetch(BASE + r.body.avatarUrl.split('?')[0])).status === 404);
const oldAvatar = r.body.avatarUrl;
r = await call('PUT', '/me/profile', s1, { avatarBase64: JPEG });
check('new avatar gets a new url', r.status === 200 && r.body.avatarUrl !== oldAvatar);
check('old avatar file removed', (await fetch(BASE + oldAvatar)).status === 404);
r = await call('PUT', '/me/profile', s1, { avatarBase64: null });
check('remove avatar', r.status === 200 && r.body.avatarUrl === null);
r = await call('GET', '/me', s1);
check('/me includes profile', r.body.major === 'นิติศาสตร์' && r.body.avatarUrl === null);
r = await call('PUT', '/me/profile', s1, { major: null });
check('clear major', r.status === 200 && r.body.major === undefined);
r = await call('PUT', '/me/profile', null, { major: null });
check('profile needs login 401', r.status === 401);

// ---- ประกาศทั่ววิทยาเขตถูกเอาออกแล้ว ----
r = await call('GET', '/broadcasts', org);
check('broadcasts removed 404', r.status === 404);
const demoPoster = await fetch(BASE + '/posters/demo-hackathon.jpg');
check('demo poster served', demoPoster.status === 200 && demoPoster.headers.get('content-type') === 'image/jpeg');
r = await call('GET', '/activities', s1);
const seeded = r.body.filter((a) => a.imageUrl?.startsWith('/posters/'));
check('seed activities have poster covers', seeded.length === 8, `${seeded.length}`);

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

// ---- push notification (เด้งแม้ปิดแอป) ----
const { isExpoPushToken, pushMessages, chunk } = await import('../server/push.mjs');
check('push token format', isExpoPushToken('ExponentPushToken[abc-123]') && !isExpoPushToken('abc') && !isExpoPushToken('ExponentPushToken[<x>]'));
const [msg] = pushMessages(['ExponentPushToken[a]'], { kind: 'activity', targetId: 'a1', title: 'หัวข้อ', body: 'รายละเอียด' });
check('push payload routes like local notification', msg.data.type === 'inbox' && msg.data.kind === 'activity' && msg.data.targetId === 'a1' && msg.sound === 'default');
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
r = await call('POST', '/me/role', s2, { role: 'activities' });
check('cannot switch to a role you do not have 403', r.status === 403);
r = await call('POST', '/auth/register', null, { studentId: `8${String(Date.now()).slice(-9)}`, fullName: 'ทดสอบ อาคาร', faculty: 'งานอาคาร', password: 'test12345', roles: ['facilities'] });
check('facilities role removed 400', r.status === 400 && r.body.fields?.roles, JSON.stringify(r.body));
r = await call('POST', '/auth/register', null, { studentId: `8${String(Date.now()).slice(-9)}`, fullName: 'บุคลากร สองบทบาท', faculty: 'งานกิจการนักศึกษา', password: 'test12345', roles: ['activities', 'student'] });
check('sign up with two roles 400', r.status === 400 && r.body.fields?.roles, JSON.stringify(r.body));
r = await call('POST', '/auth/register', null, { studentId: `8${String(Date.now()).slice(-9)}`, fullName: 'บุคลากร งานกิจกรรม', password: 'test12345', roles: ['activities'] });
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
r = await call('POST', `/registrations/${myReg}/photos`, s1, { photoBase64: JPEG });
const fileOf = (url) => url.split('?')[0].split('/').pop();
const extraFile = fileOf(r.body.checkIn.extraPhotos[1]);
const mainFile = fileOf(r.body.checkIn.photoUrl);
const signedMain = r.body.checkIn.photoUrl;
const signedExtra = r.body.checkIn.extraPhotos[1];
// ---- รูปหลักฐานต้องมีลายเซ็น ----
check('evidence url is signed', /\?exp=\d+&sig=[0-9a-f]{32}$/.test(signedMain), signedMain);
check('signed evidence photo opens', (await fetch(BASE + signedMain)).status === 200);
check('evidence photo without signature 404', (await fetch(BASE + '/uploads/' + mainFile)).status === 404);
const tampered = signedMain.slice(0, -1) + (signedMain.endsWith('0') ? '1' : '0');
check('tampered signature 404', (await fetch(BASE + tampered)).status === 404);
check('signature of another file 404', (await fetch(BASE + '/uploads/' + extraFile + signedMain.slice(signedMain.indexOf('?')))).status === 404);
check('expired signature 404', (await fetch(BASE + '/uploads/' + mainFile + '?exp=1000&sig=' + 'a'.repeat(32))).status === 404);
r = await call('GET', `/registrations/${myReg}`, s2);
check('other user cannot get evidence links 404', r.status === 404, String(r.status));
r = await call('DELETE', `/registrations/${myReg}/photos/${extraFile}`, s2);
check('cannot delete photo of another user 404', r.status === 404, String(r.status));
r = await call('DELETE', `/registrations/${myReg}/photos/${mainFile}`, s1);
check('main evidence photo cannot be deleted 404', r.status === 404, String(r.status));
r = await call('DELETE', `/registrations/${myReg}/photos/${extraFile}`, s1);
check('delete extra photo', r.status === 200 && r.body.checkIn.extraPhotos.length === 1 && !r.body.checkIn.extraPhotos[0].endsWith(extraFile), JSON.stringify(r.body));
check('deleted photo file is gone 404', (await fetch(BASE + signedExtra)).status === 404);

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
// ---- มีหลักฐานแล้วยกเลิกไม่ได้ ต้องจบกิจกรรมแทน ----
r = await call('POST', `/activities/${openActivity.id}/cancel`, org, { note: 'วิทยากรติดภารกิจ' });
check('cannot cancel activity with evidence 409', r.status === 409 && r.body.code === 'has_evidence', JSON.stringify(r.body));
r = await call('POST', `/activities/${openActivity.id}/end`, s1);
check('student cannot end activity 403', r.status === 403, String(r.status));
r = await call('POST', `/activities/${openActivity.id}/end`, org);
check('staff ends activity early', r.status === 200 && Date.parse(r.body.endsAt) <= Date.now() && !r.body.cancelledAt, JSON.stringify(r.body));
r = await call('GET', `/registrations/${myReg}`, s1);
check('evidence kept after ending early', r.body.status === 'checked_in', JSON.stringify(r.body));
r = await call('POST', `/activities/${openActivity.id}/end`, org);
check('end twice 409', r.status === 409, String(r.status));

r = await call('POST', '/auth/logout', s2);
r = await call('GET', '/me', s2);
check('token revoked after logout 401', r.status === 401);

// server ในเครื่องเดียวกัน: ไฟล์ฐานข้อมูลต้องไม่มี token ตรง ๆ
const { existsSync, readFileSync } = await import('node:fs');
const dbFile = new URL('../server/.data/db.json', import.meta.url);
if (existsSync(dbFile)) {
  const raw = readFileSync(dbFile, 'utf8');
  check('db.json stores no raw tokens', !raw.includes(s1) && !raw.includes(org) && !raw.includes('"token"'));
}

// ล้างข้อมูลขณะ server เปิด (npm run reset-live): ไม่มีในแอป ต้องใช้ token ในไฟล์ server/.data
r = await call('POST', '/demo/reset', s1, {});
check('no demo reset endpoint 404', r.status === 404, String(r.status));
r = await call('POST', '/admin/reset', s1);
check('admin reset without token 404', r.status === 404, String(r.status));
r = await call('POST', '/admin/reset', null, undefined, { 'x-admin-token': 'x' });
check('admin reset with wrong token 404', r.status === 404, String(r.status));
r = await call('GET', '/me', s1);
check('data kept after rejected reset', r.status === 200, String(r.status));
const tokenFile = new URL(`../server/.data/admin-token-${new URL(BASE).port || '80'}`, import.meta.url);
if (existsSync(tokenFile)) {
  // ท้ายสุด: ล้างจริง แล้วรัน smoke ซ้ำได้โดยไม่ต้อง reset-data
  r = await call('POST', '/admin/reset', null, undefined, { 'x-admin-token': readFileSync(tokenFile, 'utf8').trim() });
  check('admin reset with token 204', r.status === 204, String(r.status));
  r = await call('GET', '/me', s1);
  check('sessions cleared after reset 401', r.status === 401, String(r.status));
  check('seed account works after reset', Boolean(await login('6609876543', 'campus1234')));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
