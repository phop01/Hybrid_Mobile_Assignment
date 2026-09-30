import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { isActivitiesStaff } from '@/lib/tickets';
import { ApiError, setUnauthorizedHandler } from '@/services/api-client';
import * as api from '@/services/campus-api';
import { forgetPush } from '@/services/push';
import { clearAllReminders } from '@/services/reminders';
import { isUser } from '@/services/validators';
import { USER_DATA_KEYS, USER_KEY } from '@/storage/keys';
import { readJson, removeKeys, writeJson } from '@/storage/kv';
import { clearOfflineData } from '@/storage/offline-db';
import { clearToken, loadToken, saveToken } from '@/storage/token-storage';
import type { AccountRole, User } from '@/types/models';

export type SessionState =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'authenticated'; token: string; user: User };

type SessionContextValue = {
  session: SessionState;
  signIn: (studentId: string, password: string) => Promise<void>;
  signUp: (input: api.SignUpInput) => Promise<void>;
  signOut: () => Promise<void>;
  /** เปลี่ยนบทบาทที่ใช้อยู่ (บัญชีที่มีหลายบทบาท) */
  switchRole: (role: AccountRole) => Promise<void>;
};

// ข้อมูลโปรไฟล์ (ไม่ใช่ความลับ) เก็บไว้ด้วย (USER_KEY) เพื่อเปิดแอปตอนไม่มีเน็ตแล้วยังเข้าระบบอยู่
// เช่น ไปถึงงานที่สัญญาณไม่ดี ต้องยังเปิดการลงทะเบียนและเช็กอินแบบออฟไลน์ได้

const SessionContext = createContext<SessionContextValue | null>(null);

// หน้าที่จะพาไปหลัง login สำเร็จ (ตั้งจากหน้า login อ่านจาก root layout)
let postLoginRedirect: string | null = null;
export function setPostLoginRedirect(path: string | null) {
  postLoginRedirect = path;
}
export function consumePostLoginRedirect(): string | null {
  const path = postLoginRedirect;
  postLoginRedirect = null;
  return path;
}

async function wipeLocalSession() {
  // Logout ต้องล้างทุกอย่างของผู้ใช้ เครื่องอาจใช้ร่วมกัน
  forgetPush();
  await Promise.allSettled([clearToken(), removeKeys(USER_DATA_KEYS), clearOfflineData(), clearAllReminders()]);
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState>({ status: 'loading' });

  // ฟื้น session ตอนเปิดแอป ผู้ใช้ไม่ต้อง login ใหม่ทุกครั้ง
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await loadToken().catch(() => null);
      if (!token) return setSession({ status: 'anonymous' });
      try {
        const user = await api.getMe(token);
        await writeJson(USER_KEY, user);
        if (!cancelled) setSession({ status: 'authenticated', token, user });
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          // token หมดอายุหรือใช้ไม่ได้ → ล้างแล้วกลับไปสถานะยังไม่ login
          await wipeLocalSession();
          if (!cancelled) setSession({ status: 'anonymous' });
          return;
        }
        // ออฟไลน์ / server ล่มชั่วคราว: เชื่อ token ไว้ก่อน server จะตรวจอีกทีตอนส่งข้อมูล
        // ห้ามล้างข้อมูลในเครื่อง ไม่อย่างนั้นเช็กอิน/เรื่องแจ้งที่รอส่งในคิวจะหายไป
        const cachedUser = await readJson<User | null>(USER_KEY, (v): v is User | null => v === null || isUser(v), null);
        if (cancelled) return;
        // ไม่มีโปรไฟล์ในเครื่อง → ให้ login ใหม่ แต่ยังเก็บ token/คิวไว้ ครั้งหน้าเปิดแอปจะลองใหม่
        setSession(cachedUser ? { status: 'authenticated', token, user: cachedUser } : { status: 'anonymous' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const accept = useCallback(async ({ token, user }: { token: string; user: User }) => {
    await saveToken(token);
    await writeJson(USER_KEY, user);
    setSession({ status: 'authenticated', token, user });
  }, []);

  const signIn = useCallback(
    async (studentId: string, password: string) => accept(await api.login(studentId, password)),
    [accept],
  );

  // สมัครเสร็จ server ส่ง token กลับมาเลย ผู้ใช้ไม่ต้อง login ซ้ำ
  const signUp = useCallback(async (input: api.SignUpInput) => accept(await api.signUp(input)), [accept]);

  // บัญชีที่มีหลายบทบาท: เปลี่ยนบทบาทที่ใช้อยู่ (token เดิม บัญชีเดิม) แท็บและสิทธิ์เปลี่ยนตามบทบาทใหม่
  const switchRole = useCallback(
    async (role: AccountRole) => {
      if (session.status !== 'authenticated') return;
      const user = await api.setActiveRole(session.token, role);
      await writeJson(USER_KEY, user);
      setSession({ status: 'authenticated', token: session.token, user });
    },
    [session],
  );

  const signOut = useCallback(async () => {
    const current = session;
    if (current.status === 'authenticated') await api.logout(current.token).catch(() => undefined);
    await wipeLocalSession();
    setSession({ status: 'anonymous' });
  }, [session]);

  // server ตอบ 401 (token หมดอายุ) ที่ไหนก็ตาม → ออกจากระบบ
  // เฉพาะเมื่อเป็น token ของ session ปัจจุบัน (request ค้างของบัญชีที่ logout ไปแล้วไม่นับ)
  const tokenRef = useRef<string | null>(null);
  useEffect(() => {
    tokenRef.current = session.status === 'authenticated' ? session.token : null;
  }, [session]);
  useEffect(() => {
    setUnauthorizedHandler((token) => {
      if (token !== tokenRef.current) return;
      wipeLocalSession().then(() => setSession({ status: 'anonymous' }));
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  return (
    <SessionContext.Provider value={{ session, signIn, signUp, signOut, switchRole }}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession ต้องใช้ภายใน SessionProvider');
  return value;
}

export function useAuthenticatedSession() {
  const { session } = useSession();
  return session.status === 'authenticated' ? session : null;
}

/** session ของเจ้าหน้าที่งานกิจกรรม (null ถ้าไม่ได้ login หรือเป็นบทบาทอื่น) ตรงกับที่ server ตรวจ */
export function useOrganizerSession() {
  const session = useAuthenticatedSession();
  return isActivitiesStaff(session?.user) ? session : null;
}
