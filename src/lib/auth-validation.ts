// ตรวจฟอร์มเข้าสู่ระบบ/สมัครสมาชิก (สัปดาห์ 5 + 8)

import type { AccountRole } from '@/types/models';

/**
 * ปลายทางหลัง login ต้องเป็น path ภายในแอปเท่านั้น (กันลิงก์พาออกไปเว็บภายนอก)
 * ห้ามขึ้นต้นด้วย "//" เพราะเบราว์เซอร์ตีความเป็นโดเมนอื่น (protocol-relative URL)
 */
export function safeNext(next: unknown): string | null {
  const value = Array.isArray(next) ? next[0] : next;
  return typeof value === 'string' && /^\/(?!\/)[\w\-/[\]]*$/.test(value) ? value : null;
}

export type SignUpValues = {
  studentId: string;
  fullName: string;
  faculty: string;
  password: string;
  confirm: string;
  /** บทบาทของบัญชี (เลือกได้บทบาทเดียว) ไม่ระบุ = นักศึกษา */
  roles?: AccountRole[];
};
export type SignUpErrors = Partial<Record<keyof SignUpValues, string>>;

export function validateSignUp(v: SignUpValues): SignUpErrors {
  const errors: SignUpErrors = {};
  const roles = v.roles ?? ['student'];
  const staff = roles.some((r) => r !== 'student');
  if (roles.length !== 1) errors.roles = 'เลือกบทบาท 1 บทบาท';
  if (!/^\d{10}$/.test(v.studentId)) errors.studentId = `${staff ? 'รหัสนักศึกษา/บุคลากร' : 'รหัสนักศึกษา'}ต้องเป็นตัวเลข 10 หลัก`;
  if (v.fullName.trim().length < 4) errors.fullName = 'กรุณากรอกชื่อ-นามสกุล';
  if (v.faculty.trim().length < 2) errors.faculty = staff ? 'กรุณากรอกคณะ/หน่วยงาน' : 'กรุณากรอกคณะ';
  if (v.password.length < 8) errors.password = 'รหัสผ่านอย่างน้อย 8 ตัวอักษร';
  if (v.confirm !== v.password) errors.confirm = 'รหัสผ่านทั้งสองช่องไม่ตรงกัน';
  return errors;
}
