// Android: แผนที่สถานที่จัดงานแบบ Leaflet + OpenStreetMap ใน WebView (หน้าตาเดียวกับเว็บ)
// Google Maps ของ react-native-maps ใน Expo Go พื้นแผนที่ดำ · iPhone ยังใช้ activity-map.tsx (Apple Maps)

import { useMemo } from 'react';
import { StyleSheet } from 'react-native';

import { Colors, Radius } from '@/constants/theme';

import type { ActivityMapProps } from './activity-map';
import { activityMapHtml } from './leaflet-html';
import { LeafletWebView } from './leaflet-webview';

export function ActivityMap({ venue, title, user, height = 220 }: ActivityMapProps) {
  const userLat = user?.latitude;
  const userLng = user?.longitude;
  // สร้าง HTML ใหม่เฉพาะตอนข้อมูลเปลี่ยน ไม่งั้นแผนที่โหลดใหม่ทุกครั้งที่หน้า render
  const html = useMemo(
    () =>
      activityMapHtml({
        venue,
        title,
        user: userLat !== undefined && userLng !== undefined ? { latitude: userLat, longitude: userLng } : null,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- venue เป็น object ใหม่ทุก render ใช้ค่าที่แสดงจริงแทน
    [venue.latitude, venue.longitude, venue.name, title, userLat, userLng],
  );
  return (
    <LeafletWebView
      html={html}
      style={[styles.wrap, { height }]}
      accessibilityLabel={`แผนที่ ${venue.name}`}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: Radius.lg, overflow: 'hidden', backgroundColor: Colors.border },
});
