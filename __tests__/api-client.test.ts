// ทดสอบการจัดการเครือข่ายของ API client (สัปดาห์ 6 + 13)
// จำลองกรณีที่บทเรียนให้ทดสอบ: ออฟไลน์, 400/500, JSON เสีย, ข้อมูลผิดรูปแบบ

import { ApiError, apiRequest } from '@/services/api-client';
import * as api from '@/services/campus-api';

import { makeActivity, makeRegistration } from '../test-utils/fixtures';

const respond = (status: number, body: unknown, badJson = false) =>
  jest.fn(async () => ({
    ok: status < 400,
    status,
    json: async () => {
      if (badJson) throw new SyntaxError('Unexpected token');
      return body;
    },
  })) as unknown as typeof fetch;

it('turns a failed fetch into a network ApiError (used for offline fallback)', async () => {
  globalThis.fetch = jest.fn(async () => {
    throw new TypeError('Network request failed');
  }) as typeof fetch;
  await expect(apiRequest('/activities')).rejects.toMatchObject({ kind: 'network', isNetwork: true });
});

it('passes server error messages and field errors through', async () => {
  globalThis.fetch = respond(400, { code: 'validation_failed', message: 'ข้อมูลไม่ถูกต้อง', fields: { phone: 'เบอร์โทรต้องขึ้นต้นด้วย 0' } });
  const error = (await apiRequest('/activities', { method: 'POST', body: {} }).catch((e) => e)) as ApiError;
  expect(error).toBeInstanceOf(ApiError);
  expect(error.status).toBe(400);
  expect(error.fields.phone).toBe('เบอร์โทรต้องขึ้นต้นด้วย 0');
});

it('handles 500 with a non-JSON body', async () => {
  globalThis.fetch = respond(500, null, true);
  await expect(apiRequest('/activities')).rejects.toMatchObject({ kind: 'http', status: 500 });
});

it('rejects malformed data using runtime type guards', async () => {
  globalThis.fetch = respond(200, [{ id: 1, title: 'not a post' }]);
  await expect(api.getActivities()).rejects.toThrow('รูปแบบข้อมูลกิจกรรมจาก server ไม่ถูกต้อง');
  globalThis.fetch = respond(200, [makeActivity()]);
  await expect(api.getActivities()).resolves.toHaveLength(1);
});

it('sends token and Idempotency-Key when registering', async () => {
  const fetchMock = respond(201, makeRegistration());
  globalThis.fetch = fetchMock;
  await api.registerForActivity('tok', 'a1', makeRegistration().form, 'key-1');
  const init = (fetchMock as jest.Mock).mock.calls[0][1] as RequestInit;
  expect(init.headers).toMatchObject({ Authorization: 'Bearer tok', 'Idempotency-Key': 'key-1' });
});

it('sends the organizer review decision', async () => {
  const fetchMock = respond(200, makeRegistration({ status: 'registered', reviewNote: 'รูปไม่ชัด' }));
  globalThis.fetch = fetchMock;
  const updated = await api.reviewRegistration('tok-org', 'r1', { approve: false, note: 'รูปไม่ชัด' });
  const [url, init] = (fetchMock as jest.Mock).mock.calls[0] as [string, RequestInit];
  expect(url).toMatch(/\/registrations\/r1\/review$/);
  expect(JSON.parse(String(init.body))).toEqual({ approve: false, note: 'รูปไม่ชัด' });
  expect(updated.reviewNote).toBe('รูปไม่ชัด');
});
