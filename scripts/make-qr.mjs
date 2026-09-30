// สร้าง QR สำหรับแปะสไลด์ หลังเปิด `npm run present` (expo --tunnel) แล้ว
// ได้ 2 รูปใน notes/qr/: qr-expo-go.png (exp://…) และ qr-web.png (https://… เปิดในเบราว์เซอร์)
// ที่อยู่ tunnel อ่านจาก ngrok ที่ Expo เปิดไว้ (http://127.0.0.1:4040) หรือส่งเองก็ได้:
//   npm run qr -- xxxx-anonymous-8081.exp.direct
// เก็บที่อยู่ล่าสุดไว้ ถ้ารอบนี้เปลี่ยน = QR ในสไลด์ใช้ไม่ได้แล้ว ต้องเปลี่ยนรูป
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import QRCode from 'qrcode';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'notes', 'qr');
const LAST_FILE = join(OUT_DIR, 'url.txt');

async function tunnelHost() {
  const given = process.argv[2];
  if (given) return given.replace(/^[a-z]+:\/\//, '').replace(/[/:].*$/, '');
  try {
    const res = await fetch('http://127.0.0.1:4040/api/tunnels');
    const { tunnels } = await res.json();
    const url = tunnels.map((t) => t.public_url).find((u) => u.includes('.exp.direct'));
    if (url) return new URL(url).hostname;
  } catch {
    // ngrok ไม่ได้เปิด
  }
  return null;
}

const host = await tunnelHost();
if (!host) {
  console.error('ไม่พบ tunnel: เปิด npm run present ก่อน แล้วรอจนขึ้นว่า Tunnel ready (หรือส่งที่อยู่เอง npm run qr -- <host>.exp.direct)');
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });
const previous = existsSync(LAST_FILE) ? readFileSync(LAST_FILE, 'utf8').trim() : null;
const links = { 'qr-expo-go.png': `exp://${host}`, 'qr-web.png': `https://${host}` };
for (const [file, text] of Object.entries(links)) {
  await QRCode.toFile(join(OUT_DIR, file), text, { width: 800, margin: 2 });
  console.log(`${file}  →  ${text}`);
}
writeFileSync(LAST_FILE, host);
console.log(`\nบันทึกไว้ที่ ${OUT_DIR}`);

if (previous && previous !== host) {
  console.log('\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
  console.log(`!! ที่อยู่เปลี่ยนจาก ${previous}`);
  console.log('!! QR ในสไลด์ใช้ไม่ได้แล้ว ต้องเปลี่ยนเป็นรูปใหม่');
  console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
} else if (previous) {
  console.log('ที่อยู่เดิม QR ในสไลด์ใช้ได้');
}
