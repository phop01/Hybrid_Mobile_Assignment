// ฟอร์มแจ้งซ่อม 3 ขั้น (useReducer): 1) หมวด 2) รูป+ตำแหน่ง 3) รายละเอียด
// แยก state และการตรวจออกจากหน้าจอ ทดสอบได้ด้วย unit test

import { parseRoomCode } from '@/lib/campus';
import type { Coordinates } from '@/lib/geo';
import type { NewTicketInput, TicketCategory, TicketKind } from '@/types/models';

export type TicketFormState = {
  step: 1 | 2 | 3;
  kind: TicketKind;
  category: TicketCategory | null;
  /** รูปที่ย่อแล้ว พร้อมส่ง */
  photo: { uri: string; base64: string } | null;
  point: Coordinates | null;
  placeName: string;
  title: string;
  detail: string;
};

export type TicketFormAction =
  | { type: 'setCategory'; category: TicketCategory }
  | { type: 'setPhoto'; photo: TicketFormState['photo'] }
  | { type: 'setPoint'; point: Coordinates }
  | { type: 'setField'; field: 'placeName' | 'title' | 'detail'; value: string }
  | { type: 'next' }
  | { type: 'back' };

export function initialTicketForm(kind: TicketKind = 'repair'): TicketFormState {
  return { step: 1, kind, category: null, photo: null, point: null, placeName: '', title: '', detail: '' };
}

export type TicketFormErrors = Partial<Record<'category' | 'photo' | 'point' | 'placeName' | 'title' | 'detail', string>>;

/** ตรวจเฉพาะช่องของขั้นนั้น ไม่เด้ง error ของขั้นที่ผู้ใช้ยังไม่ถึง */
export function validateStep(state: TicketFormState, step: 1 | 2 | 3): TicketFormErrors {
  const errors: TicketFormErrors = {};
  if (step === 1 && !state.category) errors.category = 'กรุณาเลือกหมวด';
  if (step === 2) {
    // แจ้งซ่อมต้องมีรูป: ช่างรู้ว่าต้องเตรียมอะไรไป และใช้เทียบก่อน/หลังซ่อม
    if (!state.photo) errors.photo = 'แจ้งซ่อมต้องถ่ายรูปปัญหา';
    if (!state.point) errors.point = 'กรุณาปักหมุดตำแหน่ง (ใช้ตำแหน่งปัจจุบันหรือแตะแผนที่)';
    const place = state.placeName.trim();
    if (place.length < 2 || place.length > 80) errors.placeName = 'บอกจุดให้หาเจอ เช่น "อาคารเรียนรวม ชั้น 2 หน้าห้อง 204"';
  }
  if (step === 3) {
    const title = state.title.trim();
    if (title.length < 5 || title.length > 80) errors.title = 'หัวข้อต้องยาว 5–80 ตัวอักษร';
    if (state.detail.trim().length > 500) errors.detail = 'รายละเอียดยาวได้ไม่เกิน 500 ตัวอักษร';
  }
  return errors;
}

export function validateTicketForm(state: TicketFormState): TicketFormErrors {
  return { ...validateStep(state, 1), ...validateStep(state, 2), ...validateStep(state, 3) };
}

export function ticketFormReducer(state: TicketFormState, action: TicketFormAction): TicketFormState {
  switch (action.type) {
    case 'setCategory':
      return { ...state, category: action.category };
    case 'setPhoto':
      return { ...state, photo: action.photo };
    case 'setPoint':
      return { ...state, point: action.point };
    case 'setField':
      return { ...state, [action.field]: action.value };
    case 'next': {
      // ไปขั้นถัดไปได้เมื่อขั้นปัจจุบันถูกต้องเท่านั้น
      if (Object.keys(validateStep(state, state.step)).length > 0) return state;
      return state.step < 3 ? { ...state, step: (state.step + 1) as 2 | 3 } : state;
    }
    case 'back':
      return state.step > 1 ? { ...state, step: (state.step - 1) as 1 | 2 } : state;
  }
}

/** แปลง state เป็นข้อมูลที่ส่ง API (คืน null ถ้ายังไม่ครบ) */
export function toTicketInput(state: TicketFormState): NewTicketInput | null {
  if (Object.keys(validateTicketForm(state)).length > 0 || !state.category || !state.point) return null;
  return {
    kind: state.kind,
    category: state.category,
    title: state.title.trim(),
    detail: state.detail.trim(),
    location: { name: placeLabel(state.placeName), latitude: state.point.latitude, longitude: state.point.longitude },
    ...(state.photo ? { photoBase64: state.photo.base64 } : {}),
  };
}

/** พิมพ์มาแค่รหัสห้อง (เช่น "NK6301") → ใส่ชื่ออาคารและชั้นให้ด้วย ช่างอ่านแล้วรู้ทันทีว่าอยู่ตึกไหน */
function placeLabel(name: string): string {
  const trimmed = name.trim();
  const code = /^NK\s?\d{4}$/i.test(trimmed) ? parseRoomCode(trimmed) : null;
  return code ? code.label : trimmed;
}
