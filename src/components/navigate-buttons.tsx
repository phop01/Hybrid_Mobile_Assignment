// ปุ่มนำทางที่ใช้ร่วมกันในหน้ากิจกรรม และการลงทะเบียน
// ปุ่มหลักเปิดแอปแผนที่ของเครื่อง (นำทางจริง) · ปุ่มรองดูระยะ/เวลาเดินในแอปโดยไม่ต้องสลับแอป

import { router } from 'expo-router';
import { View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { directionsHref, openDirections } from '@/lib/platform-actions';
import type { Place } from '@/types/models';

import { Button } from './ui';

export function NavigateButtons({ place }: { place: Place }) {
  return (
    <View style={{ gap: Spacing.xs }}>
      <Button title="นำทางด้วยแผนที่" icon="navigate" variant="secondary" onPress={() => openDirections(place)} />
      <Button title="ดูระยะทางในแอป" icon="walk-outline" variant="ghost" onPress={() => router.push(directionsHref(place))} />
    </View>
  );
}
