import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, MinTouch, Radius, Spacing } from '@/constants/theme';
import { CATEGORIES } from '@/lib/categories';
import { isEnded, seatsLeft } from '@/lib/filter-activities';
import { formatDateRange } from '@/lib/format';
import { toAbsoluteUrl } from '@/services/api-config';
import type { Activity } from '@/types/models';

import { StatusBadge, type DisplayStatus } from './status-badge';

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
        style={({ pressed }) => [styles.main, pressed && { opacity: 0.85 }]}>
        <View style={[styles.stripe, { backgroundColor: category.color }]} />
        <View style={styles.content}>
          {/* รูปปกที่ผู้จัดเลือกจากคลัง (ถ้ามี) เป็นภาพประกอบ screen reader อ่านข้อมูลจาก label ของการ์ดแทน */}
          {activity.imageUrl ? (
            <Image
              source={{ uri: toAbsoluteUrl(activity.imageUrl) }}
              style={styles.cover}
              contentFit="cover"
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
          ) : (
            // ไม่มีรูปปก → แถบสีประเภท + ไอคอนใหญ่ ให้แต่ละประเภทแยกกันด้วยตาได้ทันที (ตกแต่ง ไม่ต้องอ่าน)
            <View
              style={[styles.band, { backgroundColor: category.soft }]}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants">
              <Ionicons name={category.icon} size={56} color={category.color} style={styles.bandIcon} />
            </View>
          )}
          <View style={styles.body}>
            <View style={styles.topRow}>
              <View style={[styles.category, { backgroundColor: category.color }]}>
                <Ionicons name={category.icon} size={14} color={Colors.onPrimary} />
                <Text style={[styles.categoryText, { color: Colors.onPrimary }]}>{category.label}</Text>
              </View>
              <View style={[styles.category, { backgroundColor: Colors.accentSoft }]}>
                <Ionicons name="hourglass-outline" size={13} color={Colors.accent} />
                <Text style={[styles.categoryText, { color: Colors.accent }]}>{activity.hours} ชม.</Text>
              </View>
              {status ? <StatusBadge status={status} /> : null}
            </View>

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
                <Text style={styles.method}>
                  {activity.checkInMethod === 'paper' ? 'เซ็นชื่อกระดาษ' : 'เช็กอินในแอป'}
                </Text>
              </View>
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
        <Ionicons
          name={isFavorite ? 'star' : 'star-outline'}
          size={24}
          color={isFavorite ? Colors.star : Colors.textMuted}
        />
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  main: { flex: 1, flexDirection: 'row' },
  // ไม่ใช้ opacity: ทำให้ข้อความสีเทาเหลือ contrast 2.9:1 อ่านยาก ใช้พื้นหลังต่างสีแทน (มีคำว่า "จบแล้ว" บอกอยู่แล้ว)
  ended: { backgroundColor: Colors.background },
  stripe: { width: 6 },
  content: { flex: 1 },
  cover: { width: '100%', aspectRatio: 16 / 9, backgroundColor: Colors.border },
  band: { height: 56, overflow: 'hidden' },
  bandIcon: { position: 'absolute', right: MinTouch + Spacing.lg, top: 4, opacity: 0.35 },
  body: { flex: 1, padding: Spacing.lg, gap: Spacing.sm },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap', paddingRight: MinTouch },
  category: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  categoryText: { fontSize: 12, fontWeight: '700' },
  star: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    width: MinTouch,
    height: MinTouch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 17, fontWeight: '700', color: Colors.text, lineHeight: 24 },
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
