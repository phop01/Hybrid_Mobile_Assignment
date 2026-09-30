import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';

import { Colors, Radius } from '@/constants/theme';
import type { Coordinates } from '@/lib/geo';
import type { Venue } from '@/types/models';

import { MapLoading } from './map-loading';

export type ActivityMapProps = {
  venue: Venue;
  title: string;
  /** ตำแหน่งผู้ใช้ (ถ้ามี) แสดงเพื่อเทียบกับพื้นที่เช็กอิน */
  user?: Coordinates | null;
  height?: number;
};

/**
 * แผนที่สถานที่จัดงาน: หมุด + วงกลมรัศมีเช็กอิน
 * แสดงได้โดยไม่ต้องขอสิทธิ์ตำแหน่ง เพราะตำแหน่งงานไม่ได้ขึ้นกับตำแหน่งผู้ใช้
 */
export function ActivityMap({ venue, title, user, height = 220 }: ActivityMapProps) {
  const span = Math.max(0.004, (venue.radiusM / 111000) * 5);
  const [ready, setReady] = useState(false);
  return (
    <View
      style={[styles.wrap, { height }]}
      accessible
      accessibilityLabel={`แผนที่ ${venue.name} บริเวณจัดงาน ${venue.radiusM} เมตร`}>
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={{ latitude: venue.latitude, longitude: venue.longitude, latitudeDelta: span, longitudeDelta: span }}
        onMapReady={() => setReady(true)}>
        <Circle
          center={venue}
          radius={venue.radiusM}
          strokeColor={Colors.primary}
          fillColor="rgba(63, 60, 187, 0.15)"
          strokeWidth={2}
        />
        <Marker coordinate={venue} title={title} description={venue.name} />
        {user ? <Marker coordinate={user} title="ตำแหน่งของคุณ" pinColor="#157F3D" /> : null}
      </MapView>
      {ready ? null : <MapLoading />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: Radius.lg, overflow: 'hidden', backgroundColor: Colors.border },
});
