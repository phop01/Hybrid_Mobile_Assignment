import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/app-text';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { MapSelection } from '@/hooks/use-campus-markers';
import { CATEGORIES } from '@/lib/categories';
import { formatDateRange } from '@/lib/format';

/**
 * การ์ดของจุดที่เลือกบนแผนที่: ไอคอนหมวด · ประเภท · ชื่อ · เวลา/สถานที่ · ปุ่มไปต่อ
 * ใช้ทั้งใต้แผนที่ในแท็บ และลอยล่างจอในแผนที่เต็มจอ
 */
export function MapSelectionCard({ selection, floating }: { selection: NonNullable<MapSelection>; floating?: boolean }) {
  const a = selection.activity;
  const category = CATEGORIES[a.category];
  return (
    <View style={[styles.card, floating && styles.floating]}>
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: category.soft }]}>
          <Ionicons name={category.icon} size={24} color={category.color} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.eyebrow, { color: category.color }]}>กิจกรรม · {category.label}</Text>
          <Text style={styles.title} numberOfLines={2}>
            {a.title}
          </Text>
        </View>
      </View>
      <View style={styles.meta}>
        <Ionicons name="time-outline" size={15} color={Colors.textMuted} />
        <Text style={styles.metaText}>{formatDateRange(a.startsAt, a.endsAt)}</Text>
      </View>
      <View style={styles.meta}>
        <Ionicons name="location-outline" size={15} color={Colors.textMuted} />
        <Text style={styles.metaText}>{a.location.name}</Text>
      </View>
      <Pressable
        onPress={() => router.push({ pathname: '/activities/[id]', params: { id: a.id } })}
        accessibilityRole="button"
        accessibilityLabel={`ดูรายละเอียด ${a.title}`}
        style={({ pressed }) => [styles.action, pressed && { opacity: 0.85 }]}>
        <Text style={styles.actionText}>ดูรายละเอียดกิจกรรม</Text>
        <Ionicons name="arrow-forward" size={16} color={Colors.onPrimary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  floating: {
    borderWidth: 0,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: { fontSize: 12, fontWeight: '800' },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.text,
    lineHeight: 24,
  },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { flex: 1, fontSize: 13, color: Colors.textMuted },
  action: {
    marginTop: Spacing.xs,
    minHeight: 46,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  actionText: { color: Colors.onPrimary, fontWeight: '700', fontSize: 15 },
});
