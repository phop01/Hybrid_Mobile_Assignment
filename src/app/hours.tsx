import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/app-text';
import { Banner, Card, ChipBar, Screen, SectionHeader, StatPill } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { summarizeAttendance } from '@/lib/attendance';
import { CATEGORIES, CATEGORY_ORDER } from '@/lib/categories';
import type { CategoryFilter } from '@/lib/filter-activities';
import { formatDate } from '@/lib/format';
import { useActivities } from '@/state/activities-context';
import { useMyRegistrations } from '@/state/my-registrations-context';

const FILTERS: { key: CategoryFilter; label: string; color?: string }[] = [
  { key: 'all', label: 'ทุกหมวด' },
  ...CATEGORY_ORDER.map((c) => ({ key: c, label: CATEGORIES[c].label, color: CATEGORIES[c].color })),
];

/**
 * รายละเอียดชั่วโมงกิจกรรม: รวมทั้งหมด → แยกตามหมวด (กี่ชั่วโมง กี่กิจกรรม) → รายการกิจกรรมที่ได้ชั่วโมง
 * แตะหมวดเพื่อกรองรายการด้านล่าง · ใช้เป็นหลักฐานยื่นชั่วโมงกิจกรรม/ทำพอร์ตได้
 */
export default function HoursScreen() {
  const { registrations } = useMyRegistrations();
  const { activities, getById } = useActivities();
  const [filter, setFilter] = useState<CategoryFilter>('all');

  const summary = summarizeAttendance(registrations, activities);
  const maxHours = Math.max(1, ...CATEGORY_ORDER.map((c) => summary.hoursByCategory[c]));
  // ได้ชั่วโมงแล้ว ใหม่สุดก่อน
  const history = registrations
    .filter((r) => r.status === 'checked_in')
    .flatMap((r) => {
      const activity = getById(r.activityId);
      return activity ? [{ registration: r, activity }] : [];
    })
    .sort((a, b) => b.activity.startsAt.localeCompare(a.activity.startsAt));
  const shown = filter === 'all' ? history : history.filter((h) => h.activity.category === filter);

  return (
    <Screen>
      <View style={styles.hero} accessible accessibilityLabel={`ชั่วโมงกิจกรรมสะสม ${summary.hours} ชั่วโมง จาก ${summary.total} กิจกรรม`}>
        <Text style={styles.eyebrow}>TOTAL HOURS · ชั่วโมงสะสมทั้งหมด</Text>
        <Text style={styles.total}>
          {summary.hours} <Text style={styles.unit}>ชั่วโมง</Text>
        </Text>
        <View style={styles.pills}>
          <StatPill tone="accent" icon="checkmark-circle" label={`เข้าร่วมแล้ว ${summary.total} กิจกรรม`} />
          {summary.pendingReview > 0 ? <StatPill tone="dark" icon="hourglass" label={`รอตรวจ ${summary.pendingHours} ชม.`} /> : null}
        </View>
      </View>

      {summary.pendingReview > 0 ? (
        <Banner tone="warning" icon="hourglass">
          มีหลักฐาน {summary.pendingReview} รายการ ({summary.pendingHours} ชม.) รอเจ้าหน้าที่ตรวจ จะนับเมื่อตรวจผ่าน
        </Banner>
      ) : null}

      <Card>
        <SectionHeader eyebrow="BY CATEGORY" title="แยกตามหมวด" />
        {CATEGORY_ORDER.map((c) => {
          const info = CATEGORIES[c];
          const hours = summary.hoursByCategory[c];
          const selected = filter === c;
          return (
            <Pressable
              key={c}
              onPress={() => setFilter(selected ? 'all' : c)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${info.label} ${hours} ชั่วโมง ${summary.byCategory[c]} กิจกรรม แตะเพื่อดูรายการ`}
              style={({ pressed }) => [styles.catRow, selected && { backgroundColor: info.soft }, pressed && { opacity: 0.85 }]}>
              <View style={[styles.catIcon, { backgroundColor: info.soft }]}>
                <Ionicons name={info.icon} size={20} color={info.color} />
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <View style={styles.catTop}>
                  <Text style={styles.catLabel}>{info.label}</Text>
                  <Text style={styles.catHours}>
                    {hours} <Text style={styles.catUnit}>ชม. · {summary.byCategory[c]} กิจกรรม</Text>
                  </Text>
                </View>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${(hours / maxHours) * 100}%`, backgroundColor: info.color }]} />
                </View>
              </View>
            </Pressable>
          );
        })}
      </Card>

      <Card>
        <SectionHeader eyebrow="HISTORY" title="กิจกรรมที่ได้ชั่วโมง" />
        <ChipBar options={FILTERS} value={filter} onChange={setFilter} />
        {shown.length === 0 ? (
          <Text style={styles.muted}>
            {history.length === 0
              ? 'ยังไม่มี เมื่อหลักฐานการเข้าร่วมผ่านการตรวจ กิจกรรมจะมาอยู่ที่นี่'
              : 'หมวดนี้ยังไม่มีกิจกรรมที่ได้ชั่วโมง'}
          </Text>
        ) : (
          shown.map(({ registration, activity }) => (
            <Pressable
              key={registration.id}
              style={({ pressed }) => [styles.historyRow, pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
              accessibilityLabel={`${activity.title}, ${CATEGORIES[activity.category].label}, ${formatDate(activity.startsAt)}, ${activity.hours} ชั่วโมง`}
              onPress={() => router.push({ pathname: '/registrations/[id]', params: { id: registration.id } })}>
              <View style={[styles.historyDot, { backgroundColor: CATEGORIES[activity.category].color }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.historyTitle} numberOfLines={2}>
                  {activity.title}
                </Text>
                <Text style={styles.muted}>
                  {CATEGORIES[activity.category].label} · {formatDate(activity.startsAt)}
                </Text>
              </View>
              <Text style={styles.historyHours}>+{activity.hours} ชม.</Text>
            </Pressable>
          ))
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: Colors.ink, borderRadius: Radius.xxl, padding: Spacing.xl, gap: Spacing.sm },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.6, color: Colors.highlight },
  total: { color: Colors.onPrimary, fontSize: 52, fontWeight: '800' },
  unit: { color: Colors.onPrimaryMuted, fontSize: 18, fontWeight: '600' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.sm, borderRadius: Radius.lg, minHeight: 56 },
  catIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  catTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: Spacing.sm },
  catLabel: { fontSize: 15, fontWeight: '700', color: Colors.text },
  catHours: { fontSize: 18, fontWeight: '800', color: Colors.text },
  catUnit: { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  track: { height: 8, backgroundColor: Colors.background, borderRadius: Radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: Radius.pill },
  muted: { fontSize: 13, color: Colors.textMuted, lineHeight: 19 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: 52, paddingVertical: 4 },
  historyDot: { width: 10, height: 10, borderRadius: 5 },
  historyTitle: { fontSize: 15, fontWeight: '600', color: Colors.text },
  historyHours: { fontSize: 15, fontWeight: '800', color: Colors.success },
});
