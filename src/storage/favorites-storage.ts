// รายการที่ "บันทึกไว้" เก็บใน AsyncStorage
// เหตุผล: เป็นรายการ ID สั้น ๆ ไม่เป็นความลับ และต้องอยู่ต่อหลังปิดแอป

import { isStringArray, readJson, writeJson } from './kv';

// ใส่เวอร์ชันใน key เผื่อวันหน้ารูปแบบข้อมูลเปลี่ยน จะได้ย้ายข้อมูลได้
const FAVORITES_KEY = 'nktoday/favorite-ids/v1';

export function loadFavoriteIds(): Promise<string[]> {
  return readJson(FAVORITES_KEY, isStringArray, []);
}

export function saveFavoriteIds(ids: string[]): Promise<void> {
  return writeJson(FAVORITES_KEY, ids);
}
