import { Alert, Linking, Platform } from 'react-native';

import type { Place } from '@/types/models';

/** ถามยืนยันก่อนทำสิ่งที่ย้อนกลับไม่ได้ (Alert ของ React Native ใช้บนเว็บไม่ได้ จึงแยกกรณี) */
export function confirmAction(title: string, message: string, confirmLabel: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'ไม่ใช่', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

/** Google Maps บนเว็บ: นำทางแบบเดินไปยังพิกัด (ใช้ได้ทุกเครื่อง จึงเป็นทางสำรองด้วย) */
export function googleMapsUrl(place: Pick<Place, 'latitude' | 'longitude'>) {
  return `https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}&travelmode=walking`;
}

/** ลิงก์เปิดแอปแผนที่ของแต่ละระบบ: iPhone = Apple Maps, Android = Google Maps, เว็บ = Google Maps */
export function mapsUrl(place: Place, os: string = Platform.OS) {
  const { latitude: lat, longitude: lng } = place;
  if (os === 'ios') return `maps://?daddr=${lat},${lng}&dirflg=w&q=${encodeURIComponent(place.name)}`;
  if (os === 'android') return `google.navigation:q=${lat},${lng}&mode=w`;
  return googleMapsUrl(place);
}

/** นำทางด้วยแอปแผนที่ของเครื่อง (เลี้ยวซ้ายขวา + เสียงนำทาง) เปิดไม่ได้ → Google Maps บนเว็บ */
export function openDirections(place: Place) {
  const url = mapsUrl(place);
  if (Platform.OS === 'web') {
    // แท็บใหม่ ไม่ให้หน้าแอปหาย
    window.open(url, '_blank', 'noopener');
    return;
  }
  Linking.openURL(url).catch(() => Linking.openURL(googleMapsUrl(place)));
}

/** ลิงก์ไปหน้า "เส้นทาง" ในแอป (หมุดฉัน + หมุดเป้าหมาย + ระยะเดิน) ใช้ร่วมทุกหน้า */
export function directionsHref(place: Place) {
  return {
    pathname: '/directions' as const,
    params: { lat: String(place.latitude), lng: String(place.longitude), name: place.name.slice(0, 80) },
  };
}

/** key สำหรับกันส่งลงทะเบียนซ้ำ (idempotency) สร้างครั้งเดียวต่อการเปิดฟอร์ม */
export function newIdempotencyKey(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
