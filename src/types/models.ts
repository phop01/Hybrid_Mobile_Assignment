// โครงสร้างข้อมูลหลักของ KKUNK Today
// กำหนดด้วย TypeScript ตั้งแต่แรก เพื่อให้ข้อมูลผิดรูปแบบถูกจับได้ตั้งแต่ตอนเขียนโค้ด

export type Category = 'academic' | 'volunteer' | 'sport' | 'culture';

/** วิธีส่งหลักฐาน: ถ่ายรูปที่งานในแอป (ใบเซ็นชื่อกระดาษถูกเอาออกแล้ว) */
export type CheckInMethod = 'app';

export type Venue = {
  name: string;
  latitude: number;
  longitude: number;
  /** รัศมีที่ถือว่า "อยู่ในงาน" (เมตร) */
  radiusM: number;
};

export type Activity = {
  id: string;
  title: string;
  description: string;
  category: Category;
  startsAt: string; // ISO 8601
  endsAt: string; // ISO 8601
  location: Venue;
  checkInMethod: CheckInMethod;
  capacity: number;
  registeredCount: number;
  /** ชั่วโมงกิจกรรมที่ได้เมื่อเข้าร่วม (ใช้สรุปชั่วโมงในโปรไฟล์) */
  hours: number;
  organizerId: string;
  organizerName: string;
  /** รูปปก/โปสเตอร์ที่ผู้จัดเลือกจากคลัง (ไม่บังคับ) */
  imageUrl?: string | null;
  /** เจ้าหน้าที่ยกเลิกกิจกรรม (ไม่มี = ยังจัดตามปกติ) */
  cancelledAt?: string | null;
  cancelReason?: string | null;
  /** เจ้าหน้าที่จบกิจกรรมก่อนเวลา (endsAt ถูกเลื่อนมาเป็นเวลานี้) */
  endedEarlyAt?: string | null;
  /** เวลาที่ผู้จัดโพสต์กิจกรรม (ข้อมูลเก่าอาจไม่มี) ใช้เรียง "ใหม่ล่าสุด" */
  createdAt?: string;
};

/** ตัวเลขสรุปที่ผู้จัดเห็นในหน้า "จัดการ" */
export type ActivityStats = { registered: number; checkedIn: number; pendingReview: number };
export type OrganizerActivity = Activity & { stats: ActivityStats };

/** ข้อมูลที่ผู้จัดส่งตอนสร้างกิจกรรม */
export type NewActivityInput = {
  title: string;
  description: string;
  category: Category;
  startsAt: string;
  endsAt: string;
  location: Venue;
  checkInMethod: CheckInMethod;
  capacity: number;
  /** รูปปก JPEG แบบ base64 (ไม่บังคับ) */
  coverBase64?: string;
};

/** rejected = เจ้าหน้าที่ไม่รับการลงทะเบียน (เหตุผลอยู่ใน reviewNote) */
export type RegistrationStatus = 'registered' | 'pending_review' | 'checked_in' | 'cancelled' | 'rejected';

/** ที่มาของรูปเช็กอิน: ให้ผู้จัดรู้ว่ารูปไหนถ่ายสด รูปไหนเลือกจากคลัง */
export type PhotoSource = 'camera' | 'library';

export type CheckInRecord = {
  photoUrl: string;
  /** ข้อมูลเก่าก่อนมีฟีเจอร์เลือกจากคลังไม่มีช่องนี้ = ถ่ายสด */
  photoSource?: PhotoSource;
  /** ไม่บังคับตำแหน่ง: null = ส่งโดยไม่มีตำแหน่ง */
  latitude: number | null;
  longitude: number | null;
  distanceM: number | null;
  takenAt: string;
  submittedAt: string;
  verifiedAt: string | null;
  /** รูปที่แนบเพิ่มหลังส่ง (ข้อมูลเก่าไม่มีช่องนี้) */
  extraPhotos?: string[];
};

export type RegistrationForm = {
  fullName: string;
  studentId: string;
  faculty: string;
  phone: string;
  dietary: string;
};

export type Registration = {
  id: string;
  activityId: string;
  status: RegistrationStatus;
  registeredAt: string;
  form: RegistrationForm;
  checkIn: CheckInRecord | null;
  /** เหตุผลที่ผู้จัดให้หลักฐานไม่ผ่าน (null = ยังไม่เคยถูกปฏิเสธ) */
  reviewNote?: string | null;
};

/** student = นักศึกษา, organizer = บุคลากรผู้จัดกิจกรรม */
export type Role = 'student' | 'organizer';

/** หน่วยงานของเจ้าหน้าที่: activities = กิจกรรม/จิตอาสา */
export type Department = 'activities';

/** บทบาทของบัญชี: บัญชีหนึ่งมีได้หลายบทบาท ใช้งานทีละบทบาท (เลือกที่แท็บ "ฉัน") */
export type AccountRole = 'student' | Department;

export type User = {
  id: string;
  studentId: string;
  fullName: string;
  faculty: string;
  /** สาขาวิชา (นักศึกษา ไม่บังคับ) */
  major?: string;
  /** บทบาทที่ใช้อยู่ตอนนี้ (server ตั้งตาม activeRole) */
  role: Role;
  /** มีเฉพาะตอนใช้บทบาทเจ้าหน้าที่ */
  department?: Department;
  /** บทบาททั้งหมดที่บัญชีนี้มี */
  roles?: AccountRole[];
  activeRole?: AccountRole;
  /** รูปโปรไฟล์ (path ที่ server) null = ยังไม่ตั้ง */
  avatarUrl?: string | null;
};

/** ข้อมูลเช็กอินที่ถ่ายแล้วแต่ยังส่งไม่ได้ (ออฟไลน์) */
export type PendingCheckIn = {
  registrationId: string;
  photoBase64: string;
  photoSource: PhotoSource;
  latitude: number | null;
  longitude: number | null;
  takenAt: string;
  createdAt: string;
};

/** ประกาศจากผู้จัดถึงผู้ลงทะเบียน (แสดงในหน้ากิจกรรม และ server ส่งเข้ากล่องแจ้งเตือนของผู้ลงทะเบียน) */
export type Announcement = {
  id: string;
  activityId: string;
  message: string;
  createdAt: string;
};

export type Place = { name: string; latitude: number; longitude: number };

// ---------- กล่องแจ้งเตือน ----------

/** แตะแจ้งเตือนแล้วไปหน้าไหน: กิจกรรม / การลงทะเบียน / หน้าตรวจหลักฐานของผู้จัด */
export type InboxKind = 'activity' | 'registration' | 'manage';

export type InboxItem = {
  id: string;
  kind: InboxKind;
  targetId: string;
  title: string;
  body: string;
  createdAt: string;
};
