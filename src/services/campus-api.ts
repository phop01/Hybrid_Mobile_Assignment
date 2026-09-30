// API ส่วนกิจกรรมและบัญชีผู้ใช้ของ KKUNK Today (ตรงกับ server/index.mjs)

import type {
  AccountRole,
  Activity,
  Announcement,
  NewActivityInput,
  OrganizerActivity,
  PhotoSource,
  Registration,
  RegistrationForm,
  User,
} from '@/types/models';

import { apiRequest } from './api-client';
import { isActivity, isAnnouncement, isOrganizerActivity, isRegistration, isUser, parseList, parseOne } from './validators';

export async function getActivities(signal?: AbortSignal): Promise<Activity[]> {
  return parseList(await apiRequest('/activities', { signal }), isActivity, 'กิจกรรม');
}

export async function getActivity(id: string, signal?: AbortSignal): Promise<Activity> {
  return parseOne(await apiRequest(`/activities/${encodeURIComponent(id)}`, { signal }), isActivity, 'กิจกรรม');
}

function parseAuth(raw: unknown): { token: string; user: User } {
  const payload = raw as { token?: unknown; user?: unknown } | null;
  if (typeof payload?.token !== 'string' || !isUser(payload.user)) {
    throw new Error('รูปแบบข้อมูลเข้าสู่ระบบไม่ถูกต้อง');
  }
  return { token: payload.token, user: payload.user };
}

export async function login(studentId: string, password: string) {
  return parseAuth(await apiRequest('/auth/login', { method: 'POST', body: { studentId, password } }));
}

export type SignUpInput = {
  studentId: string;
  fullName: string;
  faculty: string;
  password: string;
  /** บทบาทของบัญชี (เลือกได้มากกว่า 1) ไม่ส่ง = นักศึกษา */
  roles?: AccountRole[];
};

export async function signUp(input: SignUpInput) {
  return parseAuth(await apiRequest('/auth/register', { method: 'POST', body: input }));
}

/** เปลี่ยนบทบาทที่ใช้อยู่ของบัญชีนี้ (ต้องเป็นบทบาทที่บัญชีมี) คืนข้อมูลผู้ใช้ในบทบาทใหม่ */
export async function setActiveRole(token: string, role: AccountRole): Promise<User> {
  return parseOne(await apiRequest('/me/role', { method: 'POST', token, body: { role } }), isUser, 'ผู้ใช้');
}

export async function logout(token: string): Promise<void> {
  await apiRequest('/auth/logout', { method: 'POST', token });
}

export async function getMe(token: string): Promise<User> {
  return parseOne(await apiRequest('/me', { token }), isUser, 'ผู้ใช้');
}

export async function registerForActivity(
  token: string,
  activityId: string,
  form: RegistrationForm,
  idempotencyKey: string,
): Promise<Registration> {
  const payload = await apiRequest(`/activities/${encodeURIComponent(activityId)}/registrations`, {
    method: 'POST',
    token,
    body: form,
    idempotencyKey,
  });
  return parseOne(payload, isRegistration, 'การลงทะเบียน');
}

export async function getMyRegistrations(token: string, signal?: AbortSignal): Promise<Registration[]> {
  return parseList(await apiRequest('/registrations', { token, signal }), isRegistration, 'การลงทะเบียน');
}

export async function cancelRegistration(token: string, id: string): Promise<Registration> {
  const payload = await apiRequest(`/registrations/${encodeURIComponent(id)}`, { method: 'DELETE', token });
  return parseOne(payload, isRegistration, 'การลงทะเบียน');
}

export type CheckInPayload = {
  photoBase64: string;
  photoSource: PhotoSource;
  latitude: number | null;
  longitude: number | null;
  takenAt: string;
};

export async function submitCheckIn(token: string, registrationId: string, body: CheckInPayload): Promise<Registration> {
  const payload = await apiRequest(`/registrations/${encodeURIComponent(registrationId)}/check-in`, {
    method: 'POST',
    token,
    body,
  });
  return parseOne(payload, isRegistration, 'การเช็กอิน');
}

/** แนบรูปหลักฐานเพิ่มหลังส่งแล้ว */
export async function addEvidencePhoto(token: string, registrationId: string, photoBase64: string): Promise<Registration> {
  const payload = await apiRequest(`/registrations/${encodeURIComponent(registrationId)}/photos`, {
    method: 'POST',
    token,
    body: { photoBase64 },
  });
  return parseOne(payload, isRegistration, 'รูปหลักฐาน');
}

// ---------- ฝั่งผู้จัดกิจกรรม ----------

export async function createActivity(token: string, input: NewActivityInput): Promise<Activity> {
  return parseOne(await apiRequest('/activities', { method: 'POST', token, body: input }), isActivity, 'กิจกรรม');
}

export async function getOrganizerActivities(token: string, signal?: AbortSignal): Promise<OrganizerActivity[]> {
  return parseList(await apiRequest('/organizer/activities', { token, signal }), isOrganizerActivity, 'กิจกรรม');
}

export async function getAttendees(token: string, activityId: string, signal?: AbortSignal): Promise<Registration[]> {
  const payload = await apiRequest(`/activities/${encodeURIComponent(activityId)}/attendees`, { token, signal });
  return parseList(payload, isRegistration, 'ผู้เข้าร่วม');
}

/** ผู้จัดตรวจหลักฐานการเข้าร่วม: ผ่าน หรือไม่ผ่านพร้อมเหตุผล */
export async function reviewRegistration(
  token: string,
  registrationId: string,
  decision: { approve: true } | { approve: false; note: string },
): Promise<Registration> {
  const payload = await apiRequest(`/registrations/${encodeURIComponent(registrationId)}/review`, {
    method: 'POST',
    token,
    body: decision,
  });
  return parseOne(payload, isRegistration, 'การลงทะเบียน');
}

/** ผู้จัดไม่รับการลงทะเบียนของนักศึกษาคนนี้ พร้อมเหตุผล */
export async function rejectRegistration(token: string, registrationId: string, note: string): Promise<Registration> {
  const payload = await apiRequest(`/registrations/${encodeURIComponent(registrationId)}/reject`, {
    method: 'POST',
    token,
    body: { note },
  });
  return parseOne(payload, isRegistration, 'การลงทะเบียน');
}

/** ผู้จัดยกเลิกทั้งกิจกรรม (ทุกคนที่ลงทะเบียนได้แจ้งเตือน) */
export async function cancelActivity(token: string, activityId: string, note: string): Promise<Activity> {
  const payload = await apiRequest(`/activities/${encodeURIComponent(activityId)}/cancel`, {
    method: 'POST',
    token,
    body: { note },
  });
  return parseOne(payload, isActivity, 'กิจกรรม');
}

/** ผู้จัดส่งประกาศถึงทุกคนที่ลงทะเบียนกิจกรรมนี้ */
export async function sendAnnouncement(token: string, activityId: string, message: string): Promise<Announcement> {
  const payload = await apiRequest(`/activities/${encodeURIComponent(activityId)}/announcements`, {
    method: 'POST',
    token,
    body: { message },
  });
  return parseOne(payload, isAnnouncement, 'ประกาศ');
}

export async function getActivityAnnouncements(token: string, activityId: string, signal?: AbortSignal): Promise<Announcement[]> {
  const payload = await apiRequest(`/activities/${encodeURIComponent(activityId)}/announcements`, { token, signal });
  return parseList(payload, isAnnouncement, 'ประกาศ');
}
