import { useState } from 'react';

import type { Coordinates } from '@/lib/geo';
import { getCurrentCoordinates } from '@/services/location';

/** "ตำแหน่งของฉัน" บนแผนที่: ขอสิทธิ์เฉพาะตอนกด (ไม่ติดตามเบื้องหลัง) */
export function useLocateMe() {
  const [me, setMe] = useState<Coordinates | null>(null);
  const [locating, setLocating] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const locate = async () => {
    setLocating(true);
    setNote(null);
    const result = await getCurrentCoordinates();
    setLocating(false);
    if (result.status === 'ok') setMe(result.coords);
    else if (result.status === 'denied') {
      setNote(result.canAskAgain ? 'ต้องอนุญาตตำแหน่งก่อนจึงจะแสดงตำแหน่งของคุณได้' : 'ปิดสิทธิ์ตำแหน่งไว้ เปิดได้ที่การตั้งค่าของเครื่อง');
    } else setNote('หาตำแหน่งไม่เจอ ลองออกไปที่โล่งแล้วกดใหม่');
  };

  return { me, locating, note, locate };
}
