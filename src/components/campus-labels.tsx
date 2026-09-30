// ป้ายชื่ออาคารบนแผนที่ (react-native-maps) ใส่เป็นลูกของ MapView
// แผนที่พื้นฐานไม่มีชื่ออาคารในวิทยาเขต จึงวาดป้ายเองจาก src/data/campus-places.json

import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Marker } from 'react-native-maps';

import { Colors, Radius } from '@/constants/theme';
import { CAMPUS_PLACES } from '@/lib/campus';
import type { Coordinates } from '@/lib/geo';

/**
 * แตะป้ายในโหมดปักหมุด = เลือกอาคารนั้น (onPick) · โหมดอื่นแตะแล้วไม่มีอะไร (ป้ายเป็นแค่ข้อมูลประกอบ)
 * memo + tracksViewChanges={false}: ป้ายไม่เปลี่ยนหลังวาด ไม่ต้องวาดใหม่ทุกเฟรม
 */
export const CampusLabels = memo(function CampusLabels({ onPick }: { onPick?: (coords: Coordinates) => void }) {
  return (
    <>
      {/* ป้ายรอง (โรงจอดรถ สระน้ำ โรงเรียนสาธิต) ไม่แสดงบนมือถือ จอเล็กป้ายจะทับกัน */}
      {CAMPUS_PLACES.filter((place) => !place.minor).map((place) => (
        <Marker
          key={`campus-${place.id}`}
          coordinate={place}
          anchor={{ x: 0.5, y: 0.5 }}
          tracksViewChanges={false}
          zIndex={-1}
          accessibilityLabel={place.name}
          onPress={(e) => {
            e.stopPropagation();
            onPick?.({ latitude: place.latitude, longitude: place.longitude });
          }}>
          <View style={styles.label}>
            <Text style={styles.text} numberOfLines={1} maxFontSizeMultiplier={1.2}>
              {place.shortName}
            </Text>
          </View>
        </Marker>
      ))}
    </>
  );
});

const styles = StyleSheet.create({
  label: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  text: { fontSize: 11, fontWeight: '600', color: Colors.text },
});
