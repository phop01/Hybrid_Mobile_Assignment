// ขนาดตัวอักษรที่ผู้ใช้เลือกเองในแอป (ปกติ / ใหญ่ / ใหญ่มาก) ส่วนที่ไม่แตะ storage
// แยกไฟล์เพื่อให้ component อย่าง AppText ไม่ต้องพึ่ง AsyncStorage (ชุดทดสอบ component จึงไม่ต้อง mock)

import { createContext, useContext } from 'react';

export const TEXT_SCALES = [
  { key: 'normal', label: 'ปกติ', scale: 1 },
  { key: 'large', label: 'ใหญ่', scale: 1.15 },
  { key: 'xlarge', label: 'ใหญ่มาก', scale: 1.3 },
] as const;

export type TextScaleKey = (typeof TEXT_SCALES)[number]['key'];

export type TextScaleValue = { scaleKey: TextScaleKey; scale: number; setScaleKey: (key: TextScaleKey) => void };

// ค่าเริ่มต้น = ขนาดปกติ: ใช้งานได้แม้ไม่มี provider (เช่นในชุดทดสอบ)
export const TextScaleContext = createContext<TextScaleValue>({ scaleKey: 'normal', scale: 1, setScaleKey: () => undefined });

export const useTextScale = () => useContext(TextScaleContext);
