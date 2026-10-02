// ผู้ให้ขนาดตัวอักษร: จำค่าที่เลือกไว้ในเครื่อง (ไม่ผูกกับบัญชี ไม่ถูกล้างตอน logout)

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { readJson, writeJson } from '@/storage/kv';

import { TEXT_SCALES, TextScaleContext, type TextScaleKey } from './text-scale';

const KEY = 'nktoday/text-scale/v1';
const isKey = (v: unknown): v is TextScaleKey => TEXT_SCALES.some((s) => s.key === v);

export function TextScaleProvider({ children }: { children: ReactNode }) {
  const [scaleKey, setKey] = useState<TextScaleKey>('normal');

  useEffect(() => {
    let alive = true;
    readJson<TextScaleKey>(KEY, isKey, 'normal').then((saved) => alive && setKey(saved));
    return () => {
      alive = false;
    };
  }, []);

  const setScaleKey = useCallback((key: TextScaleKey) => {
    setKey(key);
    writeJson(KEY, key).catch(() => undefined);
  }, []);

  const value = useMemo(
    () => ({ scaleKey, scale: TEXT_SCALES.find((s) => s.key === scaleKey)?.scale ?? 1, setScaleKey }),
    [scaleKey, setScaleKey],
  );
  return <TextScaleContext.Provider value={value}>{children}</TextScaleContext.Provider>;
}
