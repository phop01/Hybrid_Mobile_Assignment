import { StyleSheet, Text as RNText, type TextProps } from 'react-native';

import { useTextScale } from '@/state/text-scale';

/**
 * Text ของแอป: คูณขนาดตัวอักษรตามที่ผู้ใช้เลือกในโปรไฟล์ (ปกติ/ใหญ่/ใหญ่มาก)
 * คูณเฉพาะ fontSize/lineHeight ที่ระบุไว้ใน style · ข้อความซ้อนที่ไม่ระบุขนาดจะสืบจากข้อความแม่เหมือนเดิม
 */
export function Text({ style, ...props }: TextProps) {
  const { scale } = useTextScale();
  if (scale === 1) return <RNText style={style} {...props} />;
  const flat = StyleSheet.flatten(style);
  const scaled = flat?.fontSize
    ? { ...flat, fontSize: flat.fontSize * scale, ...(flat.lineHeight ? { lineHeight: flat.lineHeight * scale } : {}) }
    : flat;
  return <RNText style={scaled} {...props} />;
}
