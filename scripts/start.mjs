// npm start = เปิด API server + Expo dev server พร้อมกันในคำสั่งเดียว
// เหตุผล: ผู้ตรวจ clone แล้วรันคำสั่งเดียวก็ใช้งานได้ ไม่ต้องเปิดหลาย terminal
// ส่ง argument ต่อให้ expo ได้ เช่น `npm start -- --web` หรือ `npm start -- --clear`

import { execSync, spawn } from 'node:child_process';
import { delimiter } from 'node:path';

import { startServer } from '../server/index.mjs';

const server = startServer();

const args = process.argv.slice(2);
const env = { ...process.env };
// --tunnel ใช้ @expo/ngrok ที่ติดตั้งแบบ global แต่ Expo หาโฟลเดอร์ global ของ npm บน Windows ไม่เจอ
// (มองที่ <prefix>/lib) → บอกตำแหน่งจริงผ่าน NODE_PATH ให้ expo โปรเซสเดียว ไม่แก้ค่าในเครื่อง
if (args.includes('--tunnel')) {
  try {
    const globalRoot = execSync('npm root -g', { encoding: 'utf8', shell: true }).trim();
    env.NODE_PATH = [globalRoot, env.NODE_PATH].filter(Boolean).join(delimiter);
  } catch {
    // หาไม่เจอก็ปล่อยให้ Expo ถามติดตั้งเอง
  }
}

// ใช้ node รัน expo CLI ตรง ๆ (ไม่ผ่าน shell) เพื่อให้ปิดพร้อมกันได้ทุกระบบปฏิบัติการ
const expoCli = new URL('../node_modules/expo/bin/cli', import.meta.url);
const expo = spawn(process.execPath, [expoCli.pathname.replace(/^\/(\w:)/, '$1'), 'start', ...args], {
  stdio: 'inherit',
  env,
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
