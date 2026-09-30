// แผนที่ปักหมุด (สัปดาห์ 10) ใช้ react-native-maps: ใช้ได้ใน Expo Go ไม่ต้องมี API key
// ใช้ในฟอร์มสร้างกิจกรรมของผู้จัด: แตะแผนที่/ลากหมุด/ใช้ตำแหน่งปัจจุบัน เพื่อกำหนดสถานที่จัดงาน
// บนเว็บใช้ pick-map.web.tsx (Leaflet + OpenStreetMap) แทน โดยรับ props ชุดเดียวกัน

import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { Colors, DEFAULT_CENTER, Radius } from '@/constants/theme';
import { regionFor, type Coordinates } from '@/lib/geo';

import { CampusLabels } from './campus-labels';
import { MapLoading } from './map-loading';

export type MapMarker = {
  id: string;
  latitude: number;
  longitude: number;
  color: string;
  title: string;
  subtitle?: string;
};

export type PickMapProps = {
  markers: MapMarker[];
  selectedId?: string | null;
  onSelectMarker?: (id: string | null) => void;
  /** โหมดปักหมุด: แตะแผนที่หรือลากหมุดเพื่อเลือกจุด */
  picked?: Coordinates | null;
  onPick?: (coords: Coordinates) => void;
  /** ตำแหน่งผู้ใช้ (ถ้ามี) */
  user?: Coordinates | null;
  /** ไม่ระบุ = ขยายเต็มพื้นที่ของ parent */
  height?: number;
  accessibilityLabel: string;
  /**
   * แตะ/ลากบนแผนที่อยู่หรือไม่ ให้หน้าที่มี ScrollView ปิดการเลื่อนชั่วคราว
   * (บน iPhone ถ้าไม่ปิด ScrollView จะแย่งนิ้วไป ลากหมุด/เลื่อนแผนที่ไม่ได้)
   */
  onInteractingChange?: (interacting: boolean) => void;
  /** แสดงป้ายชื่ออาคารในวิทยาเขต (ค่าเริ่มต้น แสดง) */
  campusLabels?: boolean;
};

export function PickMap({
  markers,
  selectedId,
  onSelectMarker,
  picked,
  onPick,
  user,
  height,
  accessibilityLabel,
  onInteractingChange,
  campusLabels = true,
}: PickMapProps) {
  const mapRef = useRef<MapView>(null);
  const [ready, setReady] = useState(false);
  const points: Coordinates[] = [...markers, ...(picked ? [picked] : []), ...(user ? [user] : [])];
  const initialRegion = regionFor(points, 0.006) ?? { ...DEFAULT_CENTER, latitudeDelta: 0.012, longitudeDelta: 0.012 };

  // จุดที่ปักเปลี่ยนจากภายนอก (เช่น กด "ใช้ตำแหน่งปัจจุบัน") → เลื่อนแผนที่ไปหา
  const pickedLat = picked?.latitude;
  const pickedLng = picked?.longitude;
  useEffect(() => {
    if (pickedLat === undefined || pickedLng === undefined) return;
    mapRef.current?.animateCamera({ center: { latitude: pickedLat, longitude: pickedLng } }, { duration: 400 });
  }, [pickedLat, pickedLng]);

  return (
    <View
      style={[styles.wrap, height ? { height } : StyleSheet.absoluteFill]}
      accessibilityLabel={accessibilityLabel}
      onTouchStart={() => onInteractingChange?.(true)}
      onTouchEnd={() => onInteractingChange?.(false)}
      onTouchCancel={() => onInteractingChange?.(false)}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        showsUserLocation={false}
        onMapReady={() => setReady(true)}
        onPress={(e) => {
          if (onPick) onPick(e.nativeEvent.coordinate);
          else onSelectMarker?.(null);
        }}>
        {markers.map((m) => (
          <Marker
            key={m.id}
            coordinate={m}
            pinColor={m.color}
            title={m.title}
            description={m.subtitle}
            // หมุดไม่เปลี่ยนหน้าตาหลังวาด ปิดการติดตามเพื่อไม่ให้วาดใหม่ทุกเฟรม (ประสิทธิภาพ สัปดาห์ 12)
            tracksViewChanges={false}
            opacity={selectedId && selectedId !== m.id ? 0.55 : 1}
            onPress={(e) => {
              e.stopPropagation();
              // โหมดปักหมุด: แตะโดนหมุดเดิมก็ถือว่าเลือกจุดนั้น
              if (onPick) onPick(e.nativeEvent.coordinate);
              else onSelectMarker?.(m.id);
            }}
          />
        ))}
        {campusLabels ? <CampusLabels onPick={onPick} /> : null}
        {user ? <Marker coordinate={user} title="ตำแหน่งของคุณ" pinColor="#2563EB" tracksViewChanges={false} /> : null}
        {picked ? (
          <Marker
            coordinate={picked}
            title="จุดที่เลือก"
            pinColor={Colors.primary}
            draggable={!!onPick}
            onDragEnd={(e) => onPick?.(e.nativeEvent.coordinate)}
          />
        ) : null}
      </MapView>
      {ready ? null : <MapLoading />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: Radius.lg, overflow: 'hidden', backgroundColor: Colors.border },
});
