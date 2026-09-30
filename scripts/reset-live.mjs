// ล้างข้อมูลกลับเป็นข้อมูลตัวอย่างขณะ server เปิดอยู่ (ไม่ต้องปิด server เหมือน reset-data)
// ทุกเครื่องต้อง login ใหม่ · ใช้ได้เฉพาะคอมที่รัน server เพราะต้องอ่าน token จาก server/.data
// วิธีใช้: npm run reset-live (server อื่น: API_URL=http://localhost:3101 npm run reset-live)
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const BASE = process.env.API_URL ?? 'http://localhost:3001';
const port = new URL(BASE).port || '80';
const tokenFile = join(dirname(fileURLToPath(import.meta.url)), '..', 'server', '.data', `admin-token-${port}`);

if (!existsSync(tokenFile)) {
  console.error(`ไม่พบ ${tokenFile} (server พอร์ต ${port} ยังไม่เปิด?) ถ้าปิด server อยู่ให้ใช้ npm run reset-data`);
  process.exit(1);
}

try {
  const res = await fetch(`${BASE}/admin/reset`, {
    method: 'POST',
    headers: { 'x-admin-token': readFileSync(tokenFile, 'utf8').trim() },
  });
  if (res.status !== 204) {
    console.error(`ล้างข้อมูลไม่สำเร็จ (${res.status}) token อาจเก่า ลองเปิด server ใหม่`);
    process.exit(1);
  }
  console.log('ล้างข้อมูลแล้ว กลับเป็นข้อมูลตัวอย่าง ทุกเครื่องต้อง login ใหม่');
} catch {
  console.error(`เชื่อมต่อ ${BASE} ไม่ได้ ถ้าปิด server อยู่ให้ใช้ npm run reset-data`);
  process.exit(1);
}
