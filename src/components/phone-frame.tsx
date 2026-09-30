// มือถือ: แอปเต็มจออยู่แล้ว ไม่ต้องมีกรอบ (เว็บใช้ phone-frame.web.tsx)

import type { ReactNode } from 'react';
import { useWindowDimensions } from 'react-native';

export function PhoneFrame({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

/** ความกว้างที่แอปใช้ได้จริง (บนเว็บในกรอบมือถือ = ความกว้างกรอบ) */
export function useAppWidth(): number {
  return useWindowDimensions().width;
}
