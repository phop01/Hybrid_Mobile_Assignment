import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View, type ImageStyle } from 'react-native';

import { Text } from '@/components/app-text';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { CATEGORIES } from '@/lib/categories';
import { formatDate, formatTime } from '@/lib/format';
import { toAbsoluteUrl } from '@/services/api-config';
import type { Activity } from '@/types/models';

/** รูปย่อกิจกรรม: รูปปก หรือพื้นสีหมวด + ไอคอน (ตกแต่ง ปุ่มที่ครอบอ่านข้อมูลแทน) */
function Thumb({ activity, style }: { activity: Activity; style: ImageStyle }) {
  const category = CATEGORIES[activity.category];
  return activity.imageUrl ? (
    <Image
      source={{ uri: toAbsoluteUrl(activity.imageUrl) }}
      style={style}
      contentFit="cover"
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  ) : (
    <View style={[style, styles.thumbPlain, { backgroundColor: category.soft }]}>
      <Ionicons name={category.icon} size={28} color={category.color} />
    </View>
  );
}

/** การ์ดเล็กแนวตั้ง ใช้ในแถวเลื่อนแนวนอน (แนะนำสำหรับคุณ) */
export function ActivityTile({ activity, onPress, width = 220 }: { activity: Activity; onPress: () => void; width?: number }) {
  const category = CATEGORIES[activity.category];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${activity.title} ${category.label} ${formatDate(activity.startsAt)} ${formatTime(activity.startsAt)}`}
      style={({ pressed }) => [styles.tile, { width }, pressed && { opacity: 0.85 }]}>
      <Thumb activity={activity} style={styles.tileImage} />
      <View style={styles.tileBody}>
        <Text style={[styles.eyebrow, { color: category.color }]}>{category.label}</Text>
        <Text style={styles.title} numberOfLines={2}>
          {activity.title}
        </Text>
        <Text style={styles.muted} numberOfLines={1}>
          {formatDate(activity.startsAt)} · {formatTime(activity.startsAt)}
        </Text>
      </View>
    </Pressable>
  );
}

/** แถวรายการมีรูปย่อซ้าย ใช้ในรายการสั้น ๆ บนหน้าแรก */
export function ActivityRow({
  activity,
  onPress,
  accessibilityLabel,
}: {
  activity: Activity;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `${activity.title} ${formatDate(activity.startsAt)} ${formatTime(activity.startsAt)}`}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}>
      <Thumb activity={activity} style={styles.rowImage} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.title} numberOfLines={1}>
          {activity.title}
        </Text>
        <Text style={styles.muted} numberOfLines={1}>
          {formatDate(activity.startsAt)} · {formatTime(activity.startsAt)}
        </Text>
        <Text style={styles.muted} numberOfLines={1}>
          {activity.location.name}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 5,
  },
  tileImage: { width: '100%', height: 120, borderRadius: Radius.lg },
  tileBody: { padding: Spacing.sm, gap: 3 },
  thumbPlain: { alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
  title: { fontSize: 15, fontWeight: '700', color: Colors.text, lineHeight: 21 },
  muted: { fontSize: 12, color: Colors.textMuted, lineHeight: 17 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: 72 },
  rowImage: { width: 64, height: 64, borderRadius: Radius.lg },
});
