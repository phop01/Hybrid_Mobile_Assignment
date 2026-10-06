import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/app-text';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { AttendanceSummary } from '@/lib/attendance';
import { CATEGORIES, CATEGORY_ORDER } from '@/lib/categories';
import { formatDate } from '@/lib/format';
import type { Activity } from '@/types/models';

/**
 * การ์ดชั่วโมงสะสมทั้งหมด (ไม่มีเป้าหมาย) + แถบสีแบ่งตามหมวด
 * แตะลูกศรลง → กางดูคร่าว ๆ (กิจกรรมล่าสุด วันที่ ชั่วโมง, ชั่วโมงที่รอตรวจ) · ล่างสุดมีลิงก์ไปหน้ารายละเอียดเพิ่มเติม
 */
export function HoursCard({ summary, recent = [] }: { summary: AttendanceSummary; recent?: Activity[] }) {
  const [open, setOpen] = useState(false);
  const parts = CATEGORY_ORDER.filter((c) => summary.hoursByCategory[c] > 0);
  return (
    <View style={styles.card}>
      <Pressable
        style={styles.top}
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`ชั่วโมงกิจกรรมสะสม ${summary.hours} ชั่วโมง จาก ${summary.total} กิจกรรม แตะเพื่อ${open ? 'ซ่อน' : 'ดู'}รายละเอียดคร่าว ๆ`}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.eyebrow}>ACTIVITY HOURS</Text>
          <Text style={styles.total}>
            {summary.hours} <Text style={styles.unit}>ชั่วโมง</Text>
          </Text>
          <Text style={styles.sub}>จาก {summary.total} กิจกรรม</Text>
        </View>
        <View style={styles.toggle}>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={Colors.ink} />
        </View>
      </Pressable>

      {/* แถบเดียวแบ่งสีตามสัดส่วนชั่วโมงแต่ละหมวด */}
      <View style={styles.bar}>
        {parts.map((c) => (
          <View
            key={c}
            style={{
              flex: summary.hoursByCategory[c],
              backgroundColor: CATEGORIES[c].color,
            }}
          />
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

      {open ? (
        <View style={styles.details}>
          <Text style={styles.detailsTitle}>เข้าร่วมล่าสุด</Text>
          {recent.length === 0 ? (
            <Text style={styles.empty}>ยังไม่มีกิจกรรมที่เข้าร่วมสำเร็จ</Text>
          ) : (
            recent.map((a) => (
              <View key={a.id} style={styles.recentRow}>
                <View style={[styles.dot, { backgroundColor: CATEGORIES[a.category].color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.recentTitle} numberOfLines={1}>
                    {a.title}
                  </Text>
                  <Text style={styles.recentDate}>{formatDate(a.startsAt)}</Text>
                </View>
                <Text style={styles.recentHours}>+{a.hours} ชม.</Text>
              </View>
            ))
          )}
          {summary.pendingHours > 0 ? (
            <Text style={styles.pending}>
              รอเจ้าหน้าที่ตรวจ {summary.pendingReview} กิจกรรม · {summary.pendingHours} ชม. (ยังไม่นับ)
            </Text>
          ) : null}
          <Pressable
            onPress={() => router.push('/hours')}
            accessibilityRole="button"
            accessibilityLabel="ดูรายละเอียดชั่วโมงเพิ่มเติม"
            style={({ pressed }) => [styles.more, pressed && { opacity: 0.85 }]}>
            <Text style={styles.moreText}>รายละเอียดเพิ่มเติม</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.ink} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.ink,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
    color: Colors.highlight,
  },
  total: { color: Colors.onPrimary, fontSize: 32, fontWeight: '800' },
  unit: { color: Colors.onPrimaryMuted, fontSize: 16, fontWeight: '600' },
  sub: { color: Colors.onPrimaryMuted, fontSize: 13 },
  toggle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.highlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.14)',
    gap: 2,
  },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, color: Colors.onPrimaryMuted },
  details: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.14)',
    paddingTop: Spacing.md,
    gap: Spacing.sm,
  },
  detailsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.highlight,
    letterSpacing: 0.4,
  },
  empty: { fontSize: 13, color: Colors.onPrimaryMuted },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  recentTitle: { fontSize: 14, fontWeight: '700', color: Colors.onPrimary },
  recentDate: { fontSize: 12, color: Colors.onPrimaryMuted },
  recentHours: { fontSize: 13, fontWeight: '800', color: Colors.highlight },
  pending: { fontSize: 12, color: Colors.onPrimaryMuted },
  more: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    marginTop: Spacing.xs,
    backgroundColor: Colors.highlight,
    borderRadius: Radius.pill,
    paddingVertical: 9,
  },
  moreText: { fontSize: 13, fontWeight: '700', color: Colors.ink },
});
