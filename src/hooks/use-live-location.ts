import { useEffect, useState } from 'react';

import type { Coordinates } from '@/lib/geo';
import { watchCoordinates } from '@/services/location';

export type LiveLocation =
  | { status: 'locating' }
  | { status: 'ok'; coords: Coordinates }
  | { status: 'denied'; canAskAgain: boolean }
  | { status: 'error'; message: string };

/**
 * ตำแหน่งสดของผู้ใช้ขณะอยู่ในหน้านี้ (ขอสิทธิ์ตอนเปิดหน้า เพราะผู้ใช้กด "ดูเส้นทาง" เอง)
 * ออกจากหน้า → หยุดติดตามทันที ไม่ติดตามเบื้องหลัง
 * ได้ตำแหน่งแล้วถ้า GPS สะดุดชั่วคราว ยังแสดงตำแหน่งล่าสุดต่อ
 */
export function useLiveLocation(): LiveLocation {
  const [state, setState] = useState<LiveLocation>({ status: 'locating' });

  useEffect(
    () =>
      watchCoordinates((event) =>
        setState((current) => (event.status === 'error' && current.status === 'ok' ? current : event)),
      ),
    [],
  );

  return state;
}
