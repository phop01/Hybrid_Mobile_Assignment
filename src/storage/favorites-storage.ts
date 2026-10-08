// รายการที่ "บันทึกไว้" เก็บใน AsyncStorage แยกตามบัญชี
// เหตุผล: เป็นรายการ ID สั้น ๆ ไม่เป็นความลับ และต้องอยู่ต่อหลังปิดแอป
// เครื่องเดียวสลับหลายบัญชีได้ จึงใส่ id บัญชีใน key ไม่ให้หัวใจของคนหนึ่งไปโผล่ในอีกบัญชี

import { isStringArray, readJson, writeJson } from './kv';

// ใส่เวอร์ชันใน key เผื่อวันหน้ารูปแบบข้อมูลเปลี่ยน จะได้ย้ายข้อมูลได้
const FAVORITES_KEY = 'nktoday/favorite-ids/v1';

/** owner = id บัญชี · null = ยังไม่เข้าสู่ระบบ (ใช้ key เดิม) */
export function favoritesKey(owner: string | null): string {
  return owner ? `${FAVORITES_KEY}/${owner}` : FAVORITES_KEY;
}

export function loadFavoriteIds(owner: string | null): Promise<string[]> {
  return readJson(favoritesKey(owner), isStringArray, []);
}

export function saveFavoriteIds(owner: string | null, ids: string[]): Promise<void> {
  return writeJson(favoritesKey(owner), ids);
}
