import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import { formatDate } from '@/lib/format';

import { Chip } from './ui';

const DAYS = [0, 1, 2, 3, 4];
const TIMES = ['09:00', '10:30', '13:00', '14:30', '16:00'];

/** เวลานัดจากวัน (นับจากวันนี้) + เวลา HH:MM คืน null ถ้าอยู่ในอดีตแล้ว */
export function appointmentFrom(dayOffset: number, time: string, now = new Date()): Date | null {
  const [h, m] = time.split(':').map(Number);
  const date = new Date(now);
  date.setDate(date.getDate() + dayOffset);
  date.setHours(h, m, 0, 0);
  return date.getTime() > now.getTime() ? date : null;
}

/**
 * เลือกเวลานัดเข้าซ่อมแบบแตะ (เร็วกว่าพิมพ์วันเวลา และไม่มีทางกรอกผิดรูปแบบ)
 * เวลาที่ผ่านไปแล้วของวันนี้กดไม่ได้
 */
export function AppointmentPicker({ onChange }: { onChange: (iso: string | null) => void }) {
  const [day, setDay] = useState(1);
  const [time, setTime] = useState<string | null>(null);
  // เวลาอ้างอิงตอนเปิดตัวเลือก (อ่านนาฬิกาครั้งเดียว ไม่อ่านทุก render)
  const [openedAt] = useState(() => new Date());

  const choose = (nextDay: number, nextTime: string | null) => {
    setDay(nextDay);
    setTime(nextTime);
    const at = nextTime ? appointmentFrom(nextDay, nextTime, new Date()) : null;
    onChange(at ? at.toISOString() : null);
  };

  const label = (d: number) => {
    if (d === 0) return 'วันนี้';
    if (d === 1) return 'พรุ่งนี้';
    const date = new Date(openedAt);
    date.setDate(date.getDate() + d);
    return formatDate(date.toISOString());
  };

  return (
    <View style={{ gap: Spacing.sm }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {DAYS.map((d) => (
          <Chip key={d} label={label(d)} selected={day === d} onPress={() => choose(d, time && appointmentFrom(d, time, openedAt) ? time : null)} />
        ))}
      </ScrollView>
      <View style={[styles.row, { flexWrap: 'wrap' }]}>
        {TIMES.map((t) => {
          const available = appointmentFrom(day, t, openedAt) !== null;
          return available ? (
            <Chip key={t} label={t} selected={time === t} onPress={() => choose(day, t)} />
          ) : (
            <Text key={t} style={styles.past} accessibilityLabel={`${t} ผ่านไปแล้ว`}>
              {t}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.sm, paddingVertical: 2 },
  past: { paddingHorizontal: Spacing.md, paddingVertical: 12, color: Colors.textMuted, textDecorationLine: 'line-through' },
});
