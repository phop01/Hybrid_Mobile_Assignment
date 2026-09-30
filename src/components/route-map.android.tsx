// Android: แผนที่เส้นทางแบบ Leaflet + OpenStreetMap ใน WebView (หน้าตาเดียวกับเว็บ)
// Google Maps ของ react-native-maps ใน Expo Go พื้นแผนที่ดำ · iPhone ยังใช้ route-map.tsx (Apple Maps)
// ตำแหน่งฉันเปลี่ยน → ส่งข้อความให้ย้ายหมุด/เส้น ไม่สร้างแผนที่ใหม่ (ไม่กระพริบ)

import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/theme';

import { HOST_ME, MSG_READY, routeMapHtml } from './leaflet-html';
import { LeafletWebView, type LeafletWebViewHandle } from './leaflet-webview';
import type { RouteMapProps } from './route-map';

export function RouteMap({ destination, destinationName, me, accessibilityLabel }: RouteMapProps) {
  const mapRef = useRef<LeafletWebViewHandle>(null);
  const [ready, setReady] = useState(false);
  const html = useMemo(
    () => routeMapHtml({ latitude: destination.latitude, longitude: destination.longitude }, destinationName),
    [destination.latitude, destination.longitude, destinationName],
  );

  const meLat = me?.latitude;
  const meLng = me?.longitude;
  useEffect(() => {
    if (!ready || meLat === undefined || meLng === undefined) return;
    mapRef.current?.send({ type: HOST_ME, latitude: meLat, longitude: meLng });
  }, [ready, meLat, meLng]);

  return (
    <LeafletWebView
      ref={mapRef}
      html={html}
      style={[StyleSheet.absoluteFill, styles.wrap]}
      accessibilityLabel={accessibilityLabel}
      onMessage={(data) => {
        if (data.type === MSG_READY) setReady(true);
      }}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: Colors.border },
});
