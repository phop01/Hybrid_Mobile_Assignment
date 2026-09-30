// บนเว็บไม่มี SecureStore จึงใช้ sessionStorage แทน
// sessionStorage หายเมื่อปิดแท็บ ลดความเสี่ยงกว่า localStorage ที่อยู่ถาวร
// (แลกกับการต้อง login ใหม่เมื่อเปิดแท็บใหม่)

const TOKEN_KEY = 'nktoday.session-token';

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

export async function loadToken(): Promise<string | null> {
  return storage()?.getItem(TOKEN_KEY) ?? null;
}

export async function saveToken(token: string): Promise<void> {
  storage()?.setItem(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  storage()?.removeItem(TOKEN_KEY);
}
