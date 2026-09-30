import type { RegistrationForm } from '@/types/models';

export type RegistrationErrors = Partial<Record<keyof RegistrationForm, string>>;

/**
 * ตรวจฟอร์มลงทะเบียนฝั่งแอป เพื่อบอกผู้ใช้ทันทีว่าช่องไหนผิด
 * server ตรวจซ้ำอีกรอบ เพราะ validation ฝั่ง client ถูกข้ามได้
 */
export function validateRegistration(form: RegistrationForm): RegistrationErrors {
  const errors: RegistrationErrors = {};
  if (form.fullName.trim().length < 2) errors.fullName = 'กรุณากรอกชื่อ-นามสกุล';
  if (!/^\d{10}$/.test(form.studentId)) errors.studentId = 'รหัสนักศึกษาต้องเป็นตัวเลข 10 หลัก';
  if (form.faculty.trim().length < 2) errors.faculty = 'กรุณากรอกคณะ';
  if (!/^0\d{9}$/.test(form.phone)) errors.phone = 'เบอร์โทรต้องขึ้นต้นด้วย 0 และมี 10 หลัก';
  if (form.dietary.length > 200) errors.dietary = 'กรอกได้ไม่เกิน 200 ตัวอักษร';
  return errors;
}

export function hasErrors(errors: RegistrationErrors): boolean {
  return Object.keys(errors).length > 0;
}
