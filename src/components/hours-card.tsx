import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/app-text';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { AttendanceSummary } from '@/lib/attendance';
import { CATEGORIES, CATEGORY_ORDER } from '@/lib/categories';

/**
 * การ์ดชั่วโมงสะสมทั้งหมด (ไม่มีเป้าหมาย) + แถบสีแบ่งตามหมวด · แตะไปหน้ารายละเอียดชั่วโมง
 * ใช้ทั้งหน้า "วันนี้" และ "ฉัน"
 */
export function HoursCard({ summary }: { summary: AttendanceSummary }) {
  const parts = CATEGORY_ORDER.filter((c) => summary.hoursByCategory[c] > 0);
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
      onPress={() => router.push('/hours')}
      accessibilityRole="button"
      accessibilityLabel={`ชั่วโมงกิจกรรมสะสม ${summary.hours} ชั่วโมง จาก ${summary.total} กิจกรรม แตะเพื่อดูแยกตามหมวด`}>
      <View style={styles.top}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.eyebrow}>ACTIVITY HOURS</Text>
          <Text style={styles.total}>
            {summary.hours} <Text style={styles.unit}>ชั่วโมง</Text>
          </Text>
          <Text style={styles.sub}>จาก {summary.total} กิจกรรม</Text>
        </View>
        <View style={styles.more}>
          <Text style={styles.moreText}>ดูรายละเอียด</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.ink} />
        </View>
      </View>

      {/* แถบเดียวแบ่งสีตามสัดส่วนชั่วโมงแต่ละหมวด */}
      <View style={styles.bar}>
        {parts.length === 0 ? null : parts.map((c) => (
          <View key={c} style={{ flex: summary.hoursByCategory[c], backgroundColor: CATEGORIES[c].color }} />
        ))}
      </View>
      <View style={styles.legend}>
        {CATEGORY_ORDER.map((c) => (
          <View key={c} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: CATEGORIES[c].color }]} />
            <Text style={styles.legendText}>
              {CATEGORIES[c].label} {summary.hoursByCategory[c]}
            </Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.ink, borderRadius: Radius.xl, padding: Spacing.lg + 2, gap: Spacing.md },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.6, color: Colors.highlight },
  total: { color: Colors.onPrimary, fontSize: 40, fontWeight: '800' },
  unit: { color: Colors.onPrimaryMuted, fontSize: 16, fontWeight: '600' },
  sub: { color: Colors.onPrimaryMuted, fontSize: 13 },
  more: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: Colors.highlight,
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  moreText: { fontSize: 12, fontWeight: '700', color: Colors.ink },
  bar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.14)', gap: 2 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, color: Colors.onPrimaryMuted },
});
