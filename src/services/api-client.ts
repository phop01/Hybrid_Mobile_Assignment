import { API_URL } from './api-config';

const TIMEOUT_MS = 12000;

/**
 * error ที่หน้าจอใช้ตัดสินใจได้
 * - network: ติดต่อ server ไม่ได้ → แสดงข้อมูลจาก cache / เก็บเช็กอินเข้าคิว
 * - http: server ตอบกลับแต่ไม่สำเร็จ → แสดงข้อความจาก server
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly kind: 'network' | 'http' | 'invalid',
    readonly status = 0,
    readonly code = '',
    readonly fields: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isNetwork() {
    return this.kind === 'network';
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
  token?: string | null;
  signal?: AbortSignal;
  idempotencyKey?: string;
};

// ให้ session provider ลงทะเบียนไว้ เพื่อ logout อัตโนมัติเมื่อ token หมดอายุ (401)
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

/**
 * จุดเดียวที่เรียก fetch ในทั้งแอป หน้าจอไม่เรียก fetch เอง
 * ตรวจ response.ok ทุกครั้ง, มี timeout และยกเลิก request ได้
 */
export async function apiRequest(path: string, options: RequestOptions = {}): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const onAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onAbort);

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
  } catch (error) {
    // ผู้เรียกยกเลิกเอง (เช่น ออกจากหน้า) → ส่งต่อเป็น AbortError ให้ผู้เรียกไม่สนใจ
    if (options.signal?.aborted) throw error;
    throw new ApiError('เชื่อมต่อ server ไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่', 'network');
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', onAbort);
  }

  if (response.status === 204) return null;

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    if (response.ok) throw new ApiError('ข้อมูลจาก server อ่านไม่ได้', 'invalid', response.status);
  }

  if (!response.ok) {
    const body = (payload ?? {}) as { message?: string; code?: string; fields?: Record<string, string> };
    if (response.status === 401 && options.token) onUnauthorized?.();
    throw new ApiError(
      body.message ?? `คำขอไม่สำเร็จ (${response.status})`,
      'http',
      response.status,
      body.code ?? '',
      body.fields ?? {},
    );
  }
  return payload;
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}
