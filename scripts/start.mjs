// npm start = เปิด API server + Expo dev server พร้อมกันในคำสั่งเดียว
// เหตุผล: ผู้ตรวจ clone แล้วรันคำสั่งเดียวก็ใช้งานได้ ไม่ต้องเปิดหลาย terminal
// ส่ง argument ต่อให้ expo ได้ เช่น `npm start -- --web` หรือ `npm start -- --clear`

import { spawn } from 'node:child_process';

import { startServer } from '../server/index.mjs';

const server = startServer();

// ใช้ node รัน expo CLI ตรง ๆ (ไม่ผ่าน shell) เพื่อให้ปิดพร้อมกันได้ทุกระบบปฏิบัติการ
const expoCli = new URL('../node_modules/expo/bin/cli', import.meta.url);
const expo = spawn(process.execPath, [expoCli.pathname.replace(/^\/(\w:)/, '$1'), 'start', ...process.argv.slice(2)], {
  stdio: 'inherit',
});

let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  if (expo.exitCode === null) expo.kill();
  server.close();
  process.exit(code);
}

expo.on('exit', (code) => stop(code ?? 0));
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => stop(0));
process.on('exit', () => {
  if (expo.exitCode === null) expo.kill();
});
