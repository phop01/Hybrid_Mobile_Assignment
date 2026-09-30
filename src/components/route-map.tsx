// แผนที่เส้นทางในแอป (สัปดาห์ 10): หมุดเป้าหมาย + หมุดตำแหน่งฉัน + เส้นตรงเชื่อมสองจุด
// ใช้ react-native-maps (Apple Maps บน iPhone) ใช้ได้ใน Expo Go ไม่ต้องมี API key และไม่เรียกบริการเส้นทางภายนอก
// บนเว็บใช้ route-map.web.tsx (Leaflet + OpenStreetMap) รับ props ชุดเดียวกัน

import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import { Colors } from '@/constants/theme';
import type { Coordinates } from '@/lib/geo';

import { CampusLabels } from './campus-labels';
import { MapLoading } from './map-loading';

export type RouteMapProps = {
  destination: Coordinates;
  destinationName: string;
  /** ตำแหน่งปัจจุบันของผู้ใช้ (null = ยังหาไม่ได้/ไม่ได้รับสิทธิ์) */
  me: Coordinates | null;
  accessibilityLabel: string;
};

const USER_COLOR = '#2563EB';

export function RouteMap({ destination, destinationName, me, accessibilityLabel }: RouteMapProps) {
  const mapRef = useRef<MapView>(null);
  const [ready, setReady] = useState(false);
  const fitted = useRef(false);

  // ได้ตำแหน่งครั้งแรก → ซูมให้เห็นทั้งสองจุด หลังจากนั้นไม่ขยับกล้องเอง (ไม่แย่งนิ้วผู้ใช้ที่กำลังเลื่อนแผนที่)
  const hasMe = me !== null;
  useEffect(() => {
    if (!ready || !hasMe || fitted.current || !me) return;
    fitted.current = true;
    mapRef.current?.fitToCoordinates([me, destination], {
      edgePadding: { top: 80, right: 60, bottom: 80, left: 60 },
      animated: true,
    });
  }, [ready, hasMe, me, destination]);

  return (
    <View style={StyleSheet.absoluteFill} accessibilityLabel={accessibilityLabel}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={{ ...destination, latitudeDelta: 0.008, longitudeDelta: 0.008 }}
        onMapReady={() => setReady(true)}>
        <CampusLabels />
        <Marker coordinate={destination} title={destinationName} pinColor={Colors.danger} tracksViewChanges={false} />
        {me ? (
          <>
            <Polyline coordinates={[me, destination]} strokeColor={Colors.primary} strokeWidth={4} lineDashPattern={[8, 6]} />
            <Marker coordinate={me} title="ตำแหน่งของคุณ" pinColor={USER_COLOR} tracksViewChanges={false} />
          </>
        ) : null}
      </MapView>
      {ready ? null : <MapLoading />}
    </View>
  );
}
