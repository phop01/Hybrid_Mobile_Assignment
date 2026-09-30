// Android: แผนที่ปักหมุดแบบ Leaflet + OpenStreetMap ใน WebView (หน้าตาเดียวกับเว็บ)
// Google Maps ของ react-native-maps ใน Expo Go พื้นแผนที่ดำ · iPhone ยังใช้ pick-map.tsx (Apple Maps) รับ props ชุดเดียวกัน

import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';

import { Colors, Radius } from '@/constants/theme';

import { HOST_SET_PICKED, MSG_PICK, MSG_SELECT, pickMapHtml } from './leaflet-html';
import { LeafletWebView, type LeafletWebViewHandle } from './leaflet-webview';
import type { MapMarker, PickMapProps } from './pick-map';

export function PickMap({
  markers,
  onSelectMarker,
  picked,
  onPick,
  user,
  height,
  accessibilityLabel,
  onInteractingChange,
  campusLabels = true,
}: PickMapProps) {
  const mapRef = useRef<LeafletWebViewHandle>(null);
  // ใช้แค่ตอนสร้างแผนที่ครั้งแรก หลังจากนั้นย้ายหมุดด้วยข้อความ (แผนที่ไม่ต้องโหลดใหม่)
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

  // จุดที่ปักเปลี่ยนจากภายนอก (กด "ใช้ตำแหน่งปัจจุบัน") → ย้ายหมุดในแผนที่
  const pickedLat = picked?.latitude;
  const pickedLng = picked?.longitude;
  useEffect(() => {
    if (pickedLat === undefined || pickedLng === undefined) return;
    mapRef.current?.send({ type: HOST_SET_PICKED, latitude: pickedLat, longitude: pickedLng });
  }, [pickedLat, pickedLng]);

  return (
    <LeafletWebView
      ref={mapRef}
      html={html}
      style={[styles.wrap, height ? { height } : StyleSheet.absoluteFill]}
      accessibilityLabel={accessibilityLabel}
      onInteractingChange={onInteractingChange}
      onMessage={(data) => {
        // รับเฉพาะรูปแบบที่คาดไว้
        if (data.type === MSG_SELECT) {
          if (data.id === null) onSelectMarker?.(null);
          else if (typeof data.id === 'string' && markers.some((m) => m.id === data.id)) onSelectMarker?.(data.id);
        } else if (data.type === MSG_PICK && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
          onPick?.({ latitude: data.latitude, longitude: data.longitude });
        }
      }}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: Radius.lg, overflow: 'hidden', backgroundColor: Colors.border },
});
