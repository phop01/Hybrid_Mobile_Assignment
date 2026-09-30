// key ของ AsyncStorage ที่ผูกกับผู้ใช้ รวมไว้ที่เดียว: logout ต้องลบให้ครบทุกอัน
// (แยกไฟล์เพื่อไม่ให้ session-context import state อื่นแล้ววน import กัน)

/** โปรไฟล์ผู้ใช้ล่าสุด (ไม่ใช่ความลับ) ใช้เปิดแอปตอนออฟไลน์ */
export const USER_KEY = 'nktoday/session-user/v1';
/** กล่องแจ้งเตือน + เวลาอ่านล่าสุด */
export const INBOX_KEY = 'nktoday/inbox/v1';
/** cache เรื่องแจ้งซ่อม + ประกาศ */
export const TICKETS_CACHE_KEY = 'nktoday/tickets-cache/v1';

export const USER_DATA_KEYS = [USER_KEY, INBOX_KEY, TICKETS_CACHE_KEY];
