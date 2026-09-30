// เวอร์ชันเว็บของแผนที่เส้นทาง: Leaflet + OpenStreetMap ใน iframe (HTML อยู่ใน leaflet-html.ts)
// ตำแหน่งฉันเปลี่ยน → ส่ง postMessage ให้ iframe ย้ายหมุด/เส้น ไม่สร้างแผนที่ใหม่ (ไม่กระพริบ)

import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Colors } from '@/constants/theme';

import { HOST_ME, MSG_READY, routeMapHtml } from './leaflet-html';
import type { RouteMapProps } from './route-map';

export function RouteMap({ destination, destinationName, me, accessibilityLabel }: RouteMapProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  // สร้าง HTML ครั้งเดียวต่อเป้าหมาย ตำแหน่งฉันส่งผ่าน postMessage
  const html = useMemo(
    () => routeMapHtml({ latitude: destination.latitude, longitude: destination.longitude }, destinationName),
    [destination.latitude, destination.longitude, destinationName],
  );

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      if ((event.data as { type?: unknown })?.type === MSG_READY) setReady(true);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const meLat = me?.latitude;
  const meLng = me?.longitude;
  useEffect(() => {
    if (!ready || meLat === undefined || meLng === undefined) return;
    frameRef.current?.contentWindow?.postMessage({ type: HOST_ME, latitude: meLat, longitude: meLng }, '*');
  }, [ready, meLat, meLng]);

  return (
    <View style={[StyleSheet.absoluteFill, styles.wrap]} accessibilityLabel={accessibilityLabel}>
      <iframe
        ref={frameRef}
        title={accessibilityLabel}
        srcDoc={html}
        style={{ border: 0, width: '100%', height: '100%' }}
        // allow-same-origin: ให้ request ของ tile มี Referer ตามนโยบาย OSM · HTML สร้างจากโค้ดเราเองและ escape แล้ว
        sandbox="allow-scripts allow-same-origin"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: Colors.border },
});
