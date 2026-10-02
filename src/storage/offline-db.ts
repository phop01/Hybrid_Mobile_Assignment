// ฐานข้อมูลในเครื่อง (SQLite) สำหรับการลงทะเบียนของฉันและคิวเช็กอินออฟไลน์
// เหตุผลที่ใช้ SQLite แทน AsyncStorage:
// - ข้อมูลเป็นตาราง มีหลายแถว และต้องลบ/อัปเดตทีละแถว (คิวเช็กอิน)
// - รูปเช็กอินที่รอส่งมีขนาดใหญ่ เก็บแยกแถวดีกว่าเขียนทับ JSON ก้อนเดียวทุกครั้ง

import * as SQLite from 'expo-sqlite';

import type { PendingCheckIn, Registration } from '@/types/models';
import { isRegistration } from '@/services/validators';

const SCHEMA_VERSION = 1;

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('nktoday.db');
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS registrations (
          id TEXT PRIMARY KEY NOT NULL,
          user_id TEXT NOT NULL,
          json TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS checkin_queue (
          registration_id TEXT PRIMARY KEY NOT NULL,
          payload TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
      `);
      await db.runAsync('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', 'schema_version', String(SCHEMA_VERSION));
      return db;
    })();
  }
  return dbPromise;
}

export async function saveRegistrationsCache(userId: string, registrations: Registration[]): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM registrations WHERE user_id = ?', userId);
    for (const r of registrations) {
      await db.runAsync('INSERT INTO registrations (id, user_id, json) VALUES (?, ?, ?)', r.id, userId, JSON.stringify(r));
    }
    await db.runAsync('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', `registrations_updated_at:${userId}`, new Date().toISOString());
  });
}

export async function loadRegistrationsCache(userId: string): Promise<{ registrations: Registration[]; updatedAt: string } | null> {
  const db = await getDb();
  const meta = await db.getFirstAsync<{ value: string }>('SELECT value FROM meta WHERE key = ?', `registrations_updated_at:${userId}`);
  if (!meta) return null;
  const rows = await db.getAllAsync<{ json: string }>('SELECT json FROM registrations WHERE user_id = ?', userId);
  const registrations: Registration[] = [];
  for (const row of rows) {
    try {
      const value: unknown = JSON.parse(row.json);
      if (isRegistration(value)) registrations.push(value);
    } catch {
      // แถวที่เสียข้ามไป ไม่ทำให้ทั้งรายการเปิดไม่ได้
    }
  }
  return { registrations, updatedAt: meta.value };
}

export async function enqueueCheckIn(item: PendingCheckIn): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO checkin_queue (registration_id, payload, created_at) VALUES (?, ?, ?)',
    item.registrationId,
    JSON.stringify(item),
    item.createdAt,
  );
}

export async function listQueuedCheckIns(): Promise<PendingCheckIn[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ payload: string }>('SELECT payload FROM checkin_queue ORDER BY created_at');
  return rows.flatMap((row) => {
    try {
      return [JSON.parse(row.payload) as PendingCheckIn];
    } catch {
      return [];
    }
  });
}

export async function removeQueuedCheckIn(registrationId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM checkin_queue WHERE registration_id = ?', registrationId);
}

/** ล้างข้อมูลของผู้ใช้ตอน logout: เครื่องอาจใช้ร่วมกัน คนต่อไปต้องไม่เห็นหรือส่งข้อมูลของเรา */
export async function clearOfflineData(): Promise<void> {
  const db = await getDb();
  await db.execAsync(
    `DELETE FROM registrations; DELETE FROM checkin_queue; DELETE FROM meta WHERE key LIKE 'registrations_updated_at:%';`,
  );
}
