// สั่นตอบสนองเบา ๆ ตอนแตะ/สำเร็จ/ผิดพลาด (iPhone/Android) · เว็บไม่มีการสั่น จึงไม่ทำอะไร
// ห่อไว้ที่เดียวและกลืน error: การสั่นเป็นของเสริม ห้ามทำให้การกดปุ่มจริงล้ม

import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const run = (action: () => Promise<void>) => {
  if (Platform.OS === 'web') return;
  action().catch(() => undefined);
};

/** แตะเลือก/สลับ เช่น ชิปหมวด หัวใจบันทึก */
export const hapticSelect = () => run(() => Haptics.selectionAsync());
/** ทำสำเร็จ เช่น ลงทะเบียน ส่งหลักฐาน */
export const hapticSuccess = () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
/** ทำไม่สำเร็จ */
export const hapticError = () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
