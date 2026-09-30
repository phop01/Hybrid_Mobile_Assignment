import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * อ่าน JSON จาก AsyncStorage อย่างปลอดภัย
 * ข้อมูลเสียหรือรูปแบบเปลี่ยน (เช่น อัปเดตแอป) → คืนค่า fallback แทนการทำให้แอป crash
 */
export async function readJson<T>(key: string, guard: (v: unknown) => v is T, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    const value: unknown = JSON.parse(raw);
    return guard(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

export async function writeJson(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function removeKeys(keys: string[]): Promise<void> {
  await AsyncStorage.multiRemove(keys);
}

export const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');
