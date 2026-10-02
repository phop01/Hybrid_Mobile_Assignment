// ดูระยะทางในแอป (สัปดาห์ 10): ปุ่มรองของ "นำทางด้วยแผนที่" ดูระยะ/เวลาเดินโดยไม่ต้องสลับแอป
// ในวิทยาเขตส่วนใหญ่เดินไป จึงแสดงเส้นตรง + ระยะ + เวลาเดินโดยประมาณ คำนวณในเครื่อง ไม่ใช้ API key/บริการภายนอก
// รับพิกัดทาง route params (มาจากภายนอกได้) จึงตรวจก่อนใช้เสมอ

import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Linking, StyleSheet, View } from 'react-native';

import { RouteMap } from '@/components/route-map';
import { Banner, Button, StateView } from '@/components/ui';
import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { firstParam } from '@/hooks/use-activity';
import { useLiveLocation } from '@/hooks/use-live-location';
import { formatDistance } from '@/lib/format';
import { ARRIVED_RADIUS_M, distanceMeters, parseCoordinates, walkingMinutes } from '@/lib/geo';
import { openDirections } from '@/lib/platform-actions';
import { Text } from '@/components/app-text';

export default function DirectionsScreen() {
  const params = useLocalSearchParams<{ lat?: string | string[]; lng?: string | string[]; name?: string | string[] }>();
  const destination = parseCoordinates(firstParam(params.lat), firstParam(params.lng));
  const name = (firstParam(params.name) ?? '').trim().slice(0, 80) || 'จุดหมาย';
  const location = useLiveLocation();

  if (!destination) {
    return (
      <StateView
        kind="empty"
        icon="location-outline"
        title="ไม่พบตำแหน่ง"
        message="ลิงก์เส้นทางไม่ถูกต้อง"
        actionLabel="กลับ"
        onAction={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      />
    );
  }

  const me = location.status === 'ok' ? location.coords : null;
  const distance = me ? distanceMeters(me, destination) : null;
  const arrived = distance !== null && distance <= ARRIVED_RADIUS_M;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: `เส้นทางไป ${name}` }} />
      <View style={styles.map}>
        <RouteMap
          destination={destination}
          destinationName={name}
          me={me}
          accessibilityLabel={`แผนที่เส้นทางไป ${name}`}
        />
      </View>

      <View style={styles.panel}>
        {distance !== null ? (
          // ข้อความนี้คือข้อมูลหลักของหน้า screen reader อ่านได้โดยไม่ต้องดูแผนที่ และประกาศเมื่อเปลี่ยน
          <View style={styles.summary} accessible accessibilityLiveRegion="polite">
            <Ionicons name={arrived ? 'flag' : 'walk'} size={28} color={arrived ? Colors.success : Colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.distance, arrived && { color: Colors.success }]}>
                {arrived ? 'ถึงแล้ว' : `ห่าง ${formatDistance(distance)}`}
              </Text>
              <Text style={styles.muted}>
                {arrived ? `อยู่ห่าง ${name} ไม่เกิน ${ARRIVED_RADIUS_M} ม.` : `เดินประมาณ ${walkingMinutes(distance)} นาที (วัดเป็นเส้นตรง)`}
              </Text>
            </View>
          </View>
        ) : location.status === 'locating' ? (
          <Banner tone="info" icon="locate">กำลังหาตำแหน่งของคุณ…</Banner>
        ) : location.status === 'denied' ? (
          <>
            <Banner tone="warning" icon="location-outline">
              ไม่ได้รับสิทธิ์ตำแหน่ง จึงแสดงเฉพาะจุดหมาย อนุญาตตำแหน่งเพื่อดูระยะทางจากตัวคุณ
            </Banner>
            {location.canAskAgain ? null : (
              <Button title="เปิดการตั้งค่า" icon="settings-outline" variant="secondary" onPress={() => Linking.openSettings()} />
            )}
          </>
        ) : location.status === 'error' ? (
          <Banner tone="warning">{location.message}</Banner>
        ) : null}
        <Button
          title="นำทางด้วยแผนที่"
          icon="navigate"
          variant="secondary"
          onPress={() => openDirections({ name, ...destination })}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  map: { flex: 1, overflow: 'hidden', borderBottomWidth: 1, borderColor: Colors.border },
  panel: { padding: Spacing.lg, gap: Spacing.sm, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
  },
  distance: { fontSize: 24, fontWeight: '800', color: Colors.text },
  muted: { fontSize: 14, color: Colors.textMuted, lineHeight: 20 },
});
