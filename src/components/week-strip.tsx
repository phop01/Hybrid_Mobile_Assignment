import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/app-text';
import { Colors, MinTouch, Radius, Spacing } from '@/constants/theme';
import { weekDays } from '@/lib/week-strip';

const DAY_NAMES = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];

/**
 * แถบ 7 วันข้างหน้า: วันที่มีกิจกรรมที่ลงทะเบียนไว้มีจุดสี · แตะวันเพื่อกรองรายการ แตะซ้ำเพื่อยกเลิก
 * เลื่อนวันตามเวลาเครื่อง ไม่เก็บสถานะวันนี้ไว้เอง
 */
export function WeekStrip({
  counts,
  selected,
  onSelect,
  now,
}: {
  counts: Record<string, number>;
  selected: string | null;
  onSelect: (key: string | null) => void;
  now?: Date;
}) {
  return (
    <View style={styles.row} accessibilityRole="tablist">
      {weekDays(now).map((day) => {
        const count = counts[day.key] ?? 0;
        const active = selected === day.key;
        return (
          <Pressable
            key={day.key}
            onPress={() => onSelect(active ? null : day.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${day.isToday ? 'วันนี้ ' : ''}${DAY_NAMES[day.date.getDay()]} ${day.date.getDate()} ${count > 0 ? `มี ${count} กิจกรรม` : 'ไม่มีกิจกรรม'}`}
            style={[styles.day, active && styles.dayActive, day.isToday && !active && styles.dayToday]}>
            <Text style={[styles.name, active && styles.activeText]} maxFontSizeMultiplier={1.2}>
              {DAY_NAMES[day.date.getDay()]}
            </Text>
            <Text style={[styles.num, active && styles.activeText]} maxFontSizeMultiplier={1.2}>
              {day.date.getDate()}
            </Text>
            <View style={[styles.dot, count > 0 && { backgroundColor: active ? Colors.onPrimary : Colors.primary }]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.xs },
  day: {
    flex: 1,
    minHeight: MinTouch + 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dayActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  dayToday: { borderColor: Colors.primary },
  name: { fontSize: 12, color: Colors.textMuted },
  num: { fontSize: 18, fontWeight: '800', color: Colors.text },
  activeText: { color: Colors.onPrimary },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'transparent' },
});
