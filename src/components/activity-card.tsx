import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Colors, MinTouch, Radius, Spacing } from '@/constants/theme';
import { CATEGORIES } from '@/lib/categories';
import { isEnded, seatsLeft } from '@/lib/filter-activities';
import { formatDateRange } from '@/lib/format';
import { toAbsoluteUrl } from '@/services/api-config';
import type { Activity } from '@/types/models';

import { StatusBadge, type DisplayStatus } from './status-badge';
import { Text } from '@/components/app-text';

type ActivityCardProps = {
  activity: Activity;
  isFavorite: boolean;
  onOpen: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  /** สถานะการลงทะเบียนของผู้ใช้ (ถ้ามี) */
  status?: DisplayStatus;
};

/**
 * การ์ดกิจกรรม ใช้ซ้ำในหน้ากิจกรรม บันทึกไว้ และของฉัน
 * รับข้อมูลผ่าน props อย่างเดียว ไม่ดึงข้อมูลเอง จึงไม่ผูกกับว่าข้อมูลมาจาก API หรือ cache
 *
 * ห่อด้วย memo (สัปดาห์ 12): วัดแล้วกดดาวใบเดียว การ์ด render ซ้ำทั้งรายการ (10/10)
 * หลังใส่ memo + ส่ง callback ที่ไม่เปลี่ยนทุก render เหลือ 1/10 (ดู __tests__/performance.test.tsx)
 */
export const ActivityCard = memo(function ActivityCard({
  activity,
  isFavorite,
  onOpen,
  onToggleFavorite,
  status,
}: ActivityCardProps) {
  const category = CATEGORIES[activity.category];
  const ended = isEnded(activity);
  const left = seatsLeft(activity);

  let seatLabel = `เหลือ ${left} ที่`;
  let seatColor: string = Colors.textMuted;
  if (activity.cancelledAt) {
    seatLabel = 'ยกเลิกแล้ว';
    seatColor = Colors.danger;
  } else if (ended) {
    seatLabel = 'จบแล้ว';
  } else if (left === 0) {
    seatLabel = 'เต็มแล้ว';
    seatColor = Colors.danger;
  } else if (left <= activity.capacity * 0.1) {
    seatLabel = `ใกล้เต็ม · เหลือ ${left} ที่`;
    seatColor = Colors.warning;
  }

  return (
    <View style={[styles.card, ended && styles.ended]}>
      <Pressable
        onPress={() => onOpen(activity.id)}
        accessibilityRole="button"
        accessibilityLabel={`${activity.title}, ${category.label}, ${formatDateRange(activity.startsAt, activity.endsAt)}, ${activity.location.name}, ${seatLabel}`}
        accessibilityHint="เปิดรายละเอียดกิจกรรม"
        style={({ pressed }) => pressed && { opacity: 0.85 }}>
        {/* ส่วนรูป: รูปปก (ถ้ามี) หรือพื้นสีหมวด + ไอคอนใหญ่ · ป้ายหมวดและชั่วโมงลอยบนรูป (ตกแต่ง label ของการ์ดอ่านแทน) */}
        <View style={styles.media} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {activity.imageUrl ? (
            <Image source={{ uri: toAbsoluteUrl(activity.imageUrl) }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.band, { backgroundColor: category.soft }]}>
              <Ionicons name={category.icon} size={84} color={category.color} style={{ opacity: 0.28 }} />
            </View>
          )}
          <View style={styles.categoryChip}>
            <Ionicons name={category.icon} size={14} color={category.color} />
            <Text style={[styles.chipText, { color: category.color }]}>{category.label}</Text>
          </View>
          <View style={styles.hoursChip}>
            <Ionicons name="hourglass-outline" size={13} color={Colors.highlight} />
            <Text style={[styles.chipText, { color: Colors.onPrimary }]}>{activity.hours} ชม.</Text>
          </View>
        </View>

        <View style={styles.body}>
          {status ? <StatusBadge status={status} /> : null}
          <Text style={styles.title}>{activity.title}</Text>
          <View style={styles.meta}>
            <Ionicons name="time-outline" size={16} color={Colors.textMuted} />
            <Text style={styles.metaText}>{formatDateRange(activity.startsAt, activity.endsAt)}</Text>
          </View>
          <View style={styles.meta}>
            <Ionicons name="location-outline" size={16} color={Colors.textMuted} />
            <Text style={styles.metaText}>{activity.location.name}</Text>
          </View>
          <View style={styles.footer}>
            <Text style={[styles.seats, { color: seatColor }]}>{seatLabel}</Text>
            <View style={styles.meta}>
              <Ionicons
                name={activity.checkInMethod === 'paper' ? 'document-text-outline' : 'phone-portrait-outline'}
                size={14}
                color={Colors.textMuted}
              />
              <Text style={styles.method}>{activity.checkInMethod === 'paper' ? 'ใบเซ็นชื่อ' : 'ถ่ายรูปที่งาน'}</Text>
            </View>
          </View>
        </View>
      </Pressable>
      {/* ปุ่มดาวแยกจากปุ่มการ์ด (ปุ่มซ้อนปุ่มใช้ไม่ได้บนเว็บและ screen reader อ่านสับสน) */}
      <Pressable
        onPress={() => onToggleFavorite(activity.id)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={
          isFavorite ? `นำ ${activity.title} ออกจากที่บันทึกไว้` : `บันทึก ${activity.title} ไว้ดูทีหลัง`
        }
        accessibilityState={{ selected: isFavorite }}
        style={styles.star}>
        <Ionicons name={isFavorite ? 'star' : 'star-outline'} size={22} color={isFavorite ? Colors.star : Colors.text} />
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xxl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 6,
  },
  // ไม่ใช้ opacity: ทำให้ข้อความสีเทาเหลือ contrast 2.9:1 อ่านยาก ใช้พื้นหลังต่างสีแทน (มีคำว่า "จบแล้ว" บอกอยู่แล้ว)
  ended: { backgroundColor: Colors.background },
  media: { height: 170, borderRadius: Radius.xl, overflow: 'hidden', backgroundColor: Colors.border },
  band: { alignItems: 'flex-end', justifyContent: 'center', paddingRight: Spacing.xl },
  categoryChip: {
    position: 'absolute',
    top: Spacing.md,
    left: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  hoursChip: {
    position: 'absolute',
    bottom: Spacing.md,
    left: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: Colors.scrim,
  },
  chipText: { fontSize: 12, fontWeight: '700' },
  body: { padding: Spacing.md, paddingTop: Spacing.md, gap: 6 },
  star: {
    position: 'absolute',
    top: 6 + Spacing.sm,
    right: 6 + Spacing.sm,
    width: MinTouch,
    height: MinTouch,
    borderRadius: MinTouch / 2,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 18, fontWeight: '800', color: Colors.text, lineHeight: 25 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { flex: 1, fontSize: 14, color: Colors.textMuted },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  seats: { fontSize: 14, fontWeight: '700' },
  method: { fontSize: 12, color: Colors.textMuted },
});
