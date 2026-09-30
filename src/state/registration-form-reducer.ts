// ฟอร์มลงทะเบียนมีหลายสถานะ (กรอก → กำลังส่ง → สำเร็จ/ล้มเหลว) และหลายช่อง
// ใช้ reducer แทน useState หลายตัว ทำให้การเปลี่ยนสถานะอยู่ที่เดียว อ่านง่าย และเขียน test ได้

import type { RegistrationErrors } from '@/lib/validate-registration';
import type { Registration, RegistrationForm } from '@/types/models';

export type FormState = {
  values: RegistrationForm;
  /** แสดง error หลังผู้ใช้กดส่งครั้งแรก ไม่ขึ้นแดงตั้งแต่ยังไม่ได้พิมพ์ */
  showErrors: boolean;
  serverErrors: RegistrationErrors;
  phase: 'editing' | 'submitting' | 'done';
  message: string | null;
  result: Registration | null;
};

export type FormAction =
  | { type: 'change'; field: keyof RegistrationForm; value: string }
  | { type: 'submit' }
  | { type: 'invalid' }
  | { type: 'success'; registration: Registration }
  // ส่งไม่สำเร็จ: ค่าที่กรอกยังอยู่ ผู้ใช้ไม่ต้องกรอกใหม่
  | { type: 'failure'; message: string; fieldErrors?: RegistrationErrors };

export function initialFormState(values: RegistrationForm): FormState {
  return { values, showErrors: false, serverErrors: {}, phase: 'editing', message: null, result: null };
}

export function registrationFormReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'change': {
      // แก้ช่องไหนแล้ว error จาก server ของช่องนั้นหายไป
      const { [action.field]: _cleared, ...rest } = state.serverErrors;
      return { ...state, values: { ...state.values, [action.field]: action.value }, serverErrors: rest };
    }
    case 'invalid':
      return { ...state, showErrors: true, message: 'กรุณาแก้ไขช่องที่ไม่ถูกต้อง' };
    case 'submit':
      return { ...state, showErrors: true, phase: 'submitting', message: null };
    case 'success':
      return { ...state, phase: 'done', result: action.registration, message: null };
    case 'failure':
      return { ...state, phase: 'editing', message: action.message, serverErrors: action.fieldErrors ?? {} };
  }
}
