// Integration test (สัปดาห์ 13): session + API client + storage ทำงานร่วมกัน
// mock เฉพาะขอบของระบบ (เครือข่าย และ SecureStore) ตามแนวทางของบทเรียน ไม่ mock โค้ดของเราเอง

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { Button } from '@/components/ui';
import { SessionProvider, useSession } from '@/state/session-context';

import { USER } from '../test-utils/fixtures';

const secure: Record<string, string> = {};
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (k: string) => secure[k] ?? null),
  setItemAsync: jest.fn(async (k: string, v: string) => {
    secure[k] = v;
  }),
  deleteItemAsync: jest.fn(async (k: string) => {
    delete secure[k];
  }),
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/storage/offline-db', () => ({ clearOfflineData: jest.fn(async () => undefined) }));
jest.mock('@/services/reminders', () => ({ clearAllReminders: jest.fn(async () => undefined) }));

type Route = (init: RequestInit | undefined) => { status: number; body?: unknown };
const routes: Record<string, Route> = {};
const json = (status: number, body?: unknown) =>
  ({ ok: status < 400, status, json: async () => body }) as unknown as Response;

beforeEach(() => {
  for (const k of Object.keys(secure)) delete secure[k];
  for (const k of Object.keys(routes)) delete routes[k];
  globalThis.fetch = jest.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const path = new URL(String(url)).pathname;
    const route = routes[`${init?.method ?? 'GET'} ${path}`];
    if (!route) throw new TypeError('Network request failed');
    const { status, body } = route(init);
    return json(status, body);
  }) as typeof fetch;
});

function Probe() {
  const { session, signIn, signOut } = useSession();
  return (
    <>
      <Text>{session.status === 'authenticated' ? `hello ${session.user.fullName}` : session.status}</Text>
      <Button title="login" onPress={() => signIn('6601234567', 'campus1234').catch(() => undefined)} />
      <Button title="logout" onPress={() => signOut()} />
    </>
  );
}

describe('session (login → SecureStore → restore → 401 logout)', () => {
  it('logs in, saves the token securely and logs out', async () => {
    routes['POST /auth/login'] = (init) => {
      const body = JSON.parse(String(init?.body));
      expect(body).toEqual({ studentId: '6601234567', password: 'campus1234' });
      return { status: 200, body: { token: 'tok-1', expiresAt: '2099-01-01T00:00:00Z', user: USER } };
    };
    routes['POST /auth/logout'] = () => ({ status: 204 });

    await render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );
    await waitFor(() => expect(screen.getByText('anonymous')).toBeTruthy());

    await act(async () => {
      fireEvent.press(screen.getByLabelText('login'));
    });
    await waitFor(() => expect(screen.getByText('hello สมชาย ใจดี')).toBeTruthy());
    expect(secure['nktoday.session-token']).toBe('tok-1');

    await act(async () => {
      fireEvent.press(screen.getByLabelText('logout'));
    });
    await waitFor(() => expect(screen.getByText('anonymous')).toBeTruthy());
    expect(secure['nktoday.session-token']).toBeUndefined();
  });

  it('restores a saved session on app start', async () => {
    secure['nktoday.session-token'] = 'tok-saved';
    routes['GET /me'] = (init) => {
      expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer tok-saved');
      return { status: 200, body: USER };
    };
    await render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );
    await waitFor(() => expect(screen.getByText('hello สมชาย ใจดี')).toBeTruthy());
  });

  it('drops an expired token (401) instead of staying logged in', async () => {
    secure['nktoday.session-token'] = 'tok-expired';
    routes['GET /me'] = () => ({ status: 401, body: { code: 'unauthorized', message: 'กรุณาเข้าสู่ระบบใหม่' } });
    await render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );
    await waitFor(() => expect(screen.getByText('anonymous')).toBeTruthy());
    expect(secure['nktoday.session-token']).toBeUndefined();
  });
});
