// react-native-maps ใช้บนเว็บไม่ได้ จึงแสดงแผนที่ OpenStreetMap ผ่าน Leaflet ใน iframe (HTML อยู่ใน leaflet-html.ts)
// iframe ถูก sandbox จึงคุยกับหน้าแอปด้วย postMessage และตรวจว่าข้อความมาจาก iframe ของเราจริง

import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Colors, Radius } from '@/constants/theme';

import { HOST_SET_PICKED, MSG_PICK, MSG_SELECT, pickMapHtml } from './leaflet-html';
import type { MapMarker, PickMapProps } from './pick-map';

export function PickMap({ markers, onSelectMarker, picked, onPick, user, height, accessibilityLabel, campusLabels = true }: PickMapProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  // ใช้แค่ตอนสร้างแผนที่ครั้งแรก หลังจากนั้นย้ายหมุดด้วย postMessage (แผนที่ไม่ต้องโหลดใหม่)
  const [initialPicked] = useState(picked ?? null);
  const pickable = !!onPick;
  const markersJson = JSON.stringify(markers);
  const userLat = user?.latitude;
  const userLng = user?.longitude;

  // สร้าง HTML ใหม่เฉพาะตอนหมุดเปลี่ยน ไม่งั้นแผนที่โหลดใหม่ (กระพริบ) ทุกครั้งที่หน้า render
  const html = useMemo(
    () =>
      pickMapHtml({
        markers: JSON.parse(markersJson) as MapMarker[],
        pickable,
        initialPicked,
        user: userLat !== undefined && userLng !== undefined ? { latitude: userLat, longitude: userLng } : null,
        campusLabels,
      }),
    [markersJson, pickable, initialPicked, userLat, userLng, campusLabels],
  );

  // จุดที่ปักเปลี่ยนจากภายนอก (กด "ใช้ตำแหน่งปัจจุบัน") → ส่งเข้า iframe ให้ย้ายหมุด
  const pickedLat = picked?.latitude;
  const pickedLng = picked?.longitude;
  useEffect(() => {
    if (pickedLat === undefined || pickedLng === undefined) return;
    frameRef.current?.contentWindow?.postMessage({ type: HOST_SET_PICKED, latitude: pickedLat, longitude: pickedLng }, '*');
  }, [pickedLat, pickedLng]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      // รับเฉพาะข้อความจาก iframe แผนที่ของเรา และรูปแบบตรงตามที่คาด
      if (event.source !== frameRef.current?.contentWindow) return;
      const data = event.data as { type?: unknown; id?: unknown; latitude?: unknown; longitude?: unknown };
      if (data?.type === MSG_SELECT) {
        if (data.id === null) onSelectMarker?.(null);
        else if (typeof data.id === 'string' && markers.some((m) => m.id === data.id)) onSelectMarker?.(data.id);
      } else if (data?.type === MSG_PICK && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
        onPick?.({ latitude: data.latitude, longitude: data.longitude });
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [markers, onSelectMarker, onPick]);

  return (
    <View style={[styles.wrap, height ? { height } : StyleSheet.absoluteFill]} accessibilityLabel={accessibilityLabel}>
      <iframe
        ref={frameRef}
        title={accessibilityLabel}
        srcDoc={html}
        style={{ border: 0, width: '100%', height: '100%' }}
        // allow-same-origin: ให้ request ของ tile มี Referer ตามนโยบาย OSM (sandbox เปล่าจะเป็น origin "null")
        // ปลอดภัยพอ เพราะ HTML ใน iframe สร้างจากโค้ดเราเอง และข้อความจากผู้ใช้ถูก escape แล้ว
        sandbox="allow-scripts allow-same-origin"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: Radius.lg, overflow: 'hidden', backgroundColor: Colors.border },
});
