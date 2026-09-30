import * as Location from 'expo-location';
import { Platform } from 'react-native';

import type { Coordinates } from '@/lib/geo';

export type LocationResult =
  | { status: 'ok'; coords: Coordinates }
  | { status: 'denied'; canAskAgain: boolean }
  | { status: 'error'; message: string };

const TIMEOUT_MS = 12000;

/**
 * อ่านตำแหน่งปัจจุบันครั้งเดียว (ขอสิทธิ์เฉพาะตอนใช้งาน ไม่ติดตามเบื้องหลัง)
 * ใช้ความแม่นยำระดับ Balanced: เช็กอินต้องการความแม่นยำระดับอาคาร ไม่ต้องละเอียดระดับเมตร
 * และใช้แบตน้อยกว่า High
 */
export async function getCurrentCoordinates(): Promise<LocationResult> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) return { status: 'denied', canAskAgain: permission.canAskAgain };

  try {
    const position = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS)),
    ]);
    return { status: 'ok', coords: { latitude: position.coords.latitude, longitude: position.coords.longitude } };
  } catch {
    // อยู่ในอาคารแล้ว GPS จับสัญญาณไม่ได้ → ลองใช้ตำแหน่งล่าสุดที่เครื่องรู้
    const last = await Location.getLastKnownPositionAsync().catch(() => null);
    if (last) return { status: 'ok', coords: { latitude: last.coords.latitude, longitude: last.coords.longitude } };
    return { status: 'error', message: 'หาตำแหน่งไม่ได้ ลองออกไปที่โล่งหรือเปิด GPS แล้วลองใหม่' };
  }
}

export type LiveLocationEvent =
  | { status: 'ok'; coords: Coordinates }
  | { status: 'denied'; canAskAgain: boolean }
  | { status: 'error'; message: string };

/**
 * ติดตามตำแหน่งต่อเนื่องขณะเปิดหน้าเส้นทาง (foreground เท่านั้น หยุดเมื่อออกจากหน้า)
 * อัปเดตเมื่อขยับอย่างน้อย 5 ม. พอให้ระยะทางลดลงตามที่เดิน โดยไม่เปลืองแบต
 * คืนฟังก์ชันหยุดติดตาม
 */
export function watchCoordinates(onEvent: (event: LiveLocationEvent) => void): () => void {
  let stopped = false;
  let subscription: Location.LocationSubscription | null = null;

  (async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (stopped) return;
    if (!permission.granted) return onEvent({ status: 'denied', canAskAgain: permission.canAskAgain });

    // เว็บ: watchPositionAsync ของ expo-location จับคู่ event ด้วย id ของเบราว์เซอร์ ซึ่งอาจไม่ตรงกับ id ของ expo
    // แล้วอัปเดตหายเงียบ ๆ จึงใช้ navigator.geolocation ตรง ๆ
    if (Platform.OS === 'web') {
      const geo = typeof navigator !== 'undefined' ? navigator.geolocation : undefined;
      if (!geo) return onEvent({ status: 'error', message: 'เบราว์เซอร์นี้หาตำแหน่งไม่ได้' });
      const watchId = geo.watchPosition(
        (position) => {
          if (!stopped) onEvent({ status: 'ok', coords: { latitude: position.coords.latitude, longitude: position.coords.longitude } });
        },
        () => {
          if (!stopped) onEvent({ status: 'error', message: 'หาตำแหน่งไม่ได้ ตรวจว่าเบราว์เซอร์อนุญาตตำแหน่งแล้ว' });
        },
      );
      subscription = { remove: () => geo.clearWatch(watchId) } as Location.LocationSubscription;
      if (stopped) subscription.remove();
      return;
    }

    try {
      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 5 },
        (position) => {
          if (!stopped) onEvent({ status: 'ok', coords: { latitude: position.coords.latitude, longitude: position.coords.longitude } });
        },
        () => {
          if (!stopped) onEvent({ status: 'error', message: 'หาตำแหน่งไม่ได้ ลองออกไปที่โล่งหรือเปิด GPS' });
        },
      );
      if (stopped) subscription.remove();
    } catch {
      if (!stopped) onEvent({ status: 'error', message: 'หาตำแหน่งไม่ได้ ลองออกไปที่โล่งหรือเปิด GPS' });
    }
  })();

  return () => {
    stopped = true;
    subscription?.remove();
  };
}

/**
 * อ่านตำแหน่งเฉพาะเมื่อผู้ใช้เคยอนุญาตแล้ว (ไม่เด้งขอสิทธิ์ เพราะผู้ใช้ไม่ได้กดอะไร)
 * ใช้เตือนระยะตอนเจ้าหน้าที่ปิดงานซ่อม
 */
export async function getCoordinatesIfPermitted(): Promise<Coordinates | null> {
  const permission = await Location.getForegroundPermissionsAsync().catch(() => null);
  if (!permission?.granted) return null;
  const result = await getCurrentCoordinates();
  return result.status === 'ok' ? result.coords : null;
}
