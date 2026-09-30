import { useEffect, useState } from 'react';

/**
 * เวลาปัจจุบันที่อัปเดตเป็นระยะ
 * ใช้แทน Date.now() ระหว่าง render (render ต้องให้ผลเหมือนเดิมทุกครั้ง)
 * และทำให้ปุ่มเช็กอินเปิดเองเมื่อถึงเวลา โดยไม่ต้องออกแล้วเข้าหน้าใหม่
 */
export function useNow(intervalMs = 15000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
