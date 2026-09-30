// ตรวจข้อมูลที่ได้จาก API ตอนรันจริง
// TypeScript ตรวจได้แค่ตอน compile แต่ JSON จากเครือข่ายอาจผิดรูปแบบได้เสมอ

import type {
  Activity,
  Announcement,
  Broadcast,
  CheckInRecord,
  InboxItem,
  OrganizerActivity,
  Place,
  Registration,
  Ticket,
  User,
} from '@/types/models';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null;
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

const CATEGORIES = ['academic', 'volunteer', 'sport', 'culture'];
const STATUSES = ['registered', 'pending_review', 'checked_in', 'cancelled'];

export function isActivity(v: unknown): v is Activity {
  if (!isObj(v) || !isObj(v.location)) return false;
  const loc = v.location;
  return (
    isStr(v.id) &&
    isStr(v.title) &&
    isStr(v.description) &&
    CATEGORIES.includes(v.category as string) &&
    isStr(v.startsAt) &&
    !Number.isNaN(Date.parse(v.startsAt)) &&
    isStr(v.endsAt) &&
    !Number.isNaN(Date.parse(v.endsAt)) &&
    (v.checkInMethod === 'app' || v.checkInMethod === 'paper') &&
    isNum(v.capacity) &&
    isNum(v.registeredCount) &&
    isStr(loc.name) &&
    isNum(loc.latitude) &&
    Math.abs(loc.latitude) <= 90 &&
    isNum(loc.longitude) &&
    Math.abs(loc.longitude) <= 180 &&
    isNum(loc.radiusM) &&
    isNum(v.hours) &&
    isStr(v.organizerId) &&
    isStr(v.organizerName) &&
    (v.imageUrl === undefined || v.imageUrl === null || isStr(v.imageUrl))
  );
}

export function isOrganizerActivity(v: unknown): v is OrganizerActivity {
  if (!isActivity(v)) return false;
  const stats = (v as unknown as Obj).stats;
  return isObj(stats) && isNum(stats.registered) && isNum(stats.checkedIn) && isNum(stats.pendingReview);
}

function isCheckIn(v: unknown): v is CheckInRecord {
  return (
    isObj(v) &&
    isStr(v.photoUrl) &&
    (v.photoSource === undefined || ['camera', 'library'].includes(v.photoSource as string)) &&
    (v.latitude === null || isNum(v.latitude)) &&
    (v.longitude === null || isNum(v.longitude)) &&
    (v.distanceM === null || isNum(v.distanceM)) &&
    isStr(v.takenAt) &&
    isStr(v.submittedAt) &&
    (v.verifiedAt === null || isStr(v.verifiedAt)) &&
    (v.extraPhotos === undefined || (Array.isArray(v.extraPhotos) && v.extraPhotos.every(isStr)))
  );
}

export function isRegistration(v: unknown): v is Registration {
  return (
    isObj(v) &&
    isStr(v.id) &&
    isStr(v.activityId) &&
    STATUSES.includes(v.status as string) &&
    isStr(v.registeredAt) &&
    isObj(v.form) &&
    isStr(v.form.fullName) &&
    isStr(v.form.studentId) &&
    (v.checkIn === null || isCheckIn(v.checkIn)) &&
    (v.reviewNote === undefined || v.reviewNote === null || isStr(v.reviewNote))
  );
}

export function isUser(v: unknown): v is User {
  return (
    isObj(v) &&
    isStr(v.id) &&
    isStr(v.studentId) &&
    isStr(v.fullName) &&
    isStr(v.faculty) &&
    (v.role === 'student' || v.role === 'organizer') &&
    (v.department === undefined || v.department === 'activities' || v.department === 'facilities') &&
    (v.roles === undefined || (Array.isArray(v.roles) && v.roles.every((r) => ACCOUNT_ROLES.includes(r as string)))) &&
    (v.activeRole === undefined || ACCOUNT_ROLES.includes(v.activeRole as string))
  );
}

const ACCOUNT_ROLES = ['student', 'activities', 'facilities'];

export function parseList<T>(payload: unknown, guard: (v: unknown) => v is T, label: string): T[] {
  if (!Array.isArray(payload) || !payload.every(guard)) {
    throw new Error(`รูปแบบข้อมูล${label}จาก server ไม่ถูกต้อง`);
  }
  return payload;
}

export function parseOne<T>(payload: unknown, guard: (v: unknown) => v is T, label: string): T {
  if (!guard(payload)) throw new Error(`รูปแบบข้อมูล${label}จาก server ไม่ถูกต้อง`);
  return payload;
}

export function isAnnouncement(v: unknown): v is Announcement {
  return isObj(v) && isStr(v.id) && isStr(v.activityId) && isStr(v.message) && isStr(v.createdAt);
}

const TICKET_KINDS = ['repair'];
const TICKET_CATEGORIES = ['electric', 'water', 'building', 'road', 'cleaning', 'other'];
const TICKET_STATUSES = ['open', 'accepted', 'done', 'confirmed', 'rejected', 'cancelled'];
const INBOX_KINDS = ['ticket', 'activity', 'registration', 'manage', 'broadcast'];

const isStrOrNull = (v: unknown): v is string | null => v === null || isStr(v);

export function isPlace(v: unknown): v is Place {
  return (
    isObj(v) &&
    isStr(v.name) &&
    isNum(v.latitude) &&
    Math.abs(v.latitude) <= 90 &&
    isNum(v.longitude) &&
    Math.abs(v.longitude) <= 180
  );
}

export function isTicket(v: unknown): v is Ticket {
  return (
    isObj(v) &&
    isStr(v.id) &&
    TICKET_KINDS.includes(v.kind as string) &&
    TICKET_CATEGORIES.includes(v.category as string) &&
    isStr(v.title) &&
    isStr(v.detail) &&
    isPlace(v.location) &&
    isStrOrNull(v.photoUrl) &&
    isStrOrNull(v.afterPhotoUrl) &&
    TICKET_STATUSES.includes(v.status as string) &&
    isStr(v.reporterId) &&
    isStr(v.reporterName) &&
    isStrOrNull(v.assigneeId) &&
    isStrOrNull(v.assigneeName) &&
    isNum(v.followerCount) &&
    typeof v.following === 'boolean' &&
    isStrOrNull(v.appointmentAt) &&
    isStrOrNull(v.note) &&
    isStr(v.createdAt) &&
    Array.isArray(v.events) &&
    v.events.every((e) => isObj(e) && isStr(e.at) && isStr(e.type) && isStr(e.byId))
  );
}

export function isBroadcast(v: unknown): v is Broadcast {
  return (
    isObj(v) &&
    isStr(v.id) &&
    isStr(v.message) &&
    isPlace(v.location) &&
    isStr(v.byId) &&
    isStr(v.byName) &&
    isStr(v.createdAt) &&
    isStr(v.expiresAt) &&
    (v.imageUrl === undefined || v.imageUrl === null || isStr(v.imageUrl))
  );
}

export function isInboxItem(v: unknown): v is InboxItem {
  return (
    isObj(v) &&
    isStr(v.id) &&
    INBOX_KINDS.includes(v.kind as string) &&
    isStr(v.targetId) &&
    isStr(v.title) &&
    isStr(v.body) &&
    isStr(v.createdAt)
  );
}
