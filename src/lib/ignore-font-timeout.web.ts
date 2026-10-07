// เว็บ: expo-font ใช้ fontfaceobserver รอฟอนต์ไอคอนโหลดเสร็จภายใน 12 วิ ถ้าเน็ตช้า
// จะ reject ด้วย "12000ms timeout exceeded" · expo-font ตั้งใจกลืน error นี้ แต่ try/catch ของมัน
// จับ promise ที่ reject ทีหลังไม่ได้ → หลุดเป็นจอแดง ทั้งที่ฟอนต์ยังแสดงได้เองเมื่อโหลดเสร็จ
// แก้ที่ต้นทาง: ห่อ loadAsync ของตัวโหลดฟอนต์ (อ็อบเจกต์เดียวกับที่ expo-font เรียก อยู่ใน globalThis.expo.modules)
// ให้กลืนเฉพาะ error นี้ตัวเดียว error อื่นยังส่งต่อตามปกติ
import 'expo-font';

const FONT_TIMEOUT = /^\d+ms timeout exceeded$/;

type FontLoader = { loadAsync: (name: string, resource: unknown) => unknown; __ignoreTimeout?: boolean };

const loader = (globalThis as { expo?: { modules?: { ExpoFontLoader?: FontLoader } } }).expo?.modules?.ExpoFontLoader;

if (loader && !loader.__ignoreTimeout) {
  const original = loader.loadAsync.bind(loader);
  loader.loadAsync = (name, resource) => {
    const result = original(name, resource);
    if (!(result instanceof Promise)) return result;
    return result.catch((error: unknown) => {
      if (error instanceof Error && FONT_TIMEOUT.test(error.message)) return;
      throw error;
    });
  };
  loader.__ignoreTimeout = true;
}
