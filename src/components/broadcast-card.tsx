// ประกาศจากเจ้าหน้าที่: มีโปสเตอร์ → การ์ดรูป (แตะดูเต็มจอ) · ไม่มี → แถบข้อความสีเหลืองแบบเดิม
// ใช้ในหน้า "วันนี้", การ์ดบนแผนที่ และรายการ "ประกาศของฉัน"

import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Colors, MinTouch, Radius, Spacing } from '@/constants/theme';
import { formatTime } from '@/lib/format';
import { toAbsoluteUrl } from '@/services/api-config';
import type { Broadcast } from '@/types/models';

import { Banner } from './ui';

const POSTER_BG = '#1F2230';

function meta(b: Broadcast) {
  return `${b.location.name} · ${b.byName} · ถึง ${formatTime(b.expiresAt)} น.`;
}

/**
 * ประกาศ 1 รายการ · width = ความกว้างคงที่เมื่ออยู่ในแถวเลื่อนแนวนอน
 * compact = รูปย่อด้านซ้าย (ใช้ใต้แผนที่ ที่พื้นที่แนวตั้งน้อย)
 */
export function BroadcastCard({ broadcast, width, compact }: { broadcast: Broadcast; width?: number; compact?: boolean }) {
  const [viewing, setViewing] = useState(false);

  if (!broadcast.imageUrl) {
    return (
      <Banner tone="warning" icon="megaphone">
        {`${broadcast.message}\n${meta(broadcast)}`}
      </Banner>
    );
  }

  const uri = toAbsoluteUrl(broadcast.imageUrl);
  return (
    <View style={[styles.card, compact && styles.cardRow, width ? { width } : null]}>
      <Pressable
        onPress={() => setViewing(true)}
        accessibilityRole="imagebutton"
        accessibilityLabel={`โปสเตอร์ประกาศ ${broadcast.message} แตะเพื่อดูเต็มจอ`}
        style={({ pressed }) => [styles.posterWrap, pressed && { opacity: 0.9 }]}>
        <Image source={{ uri }} style={compact ? styles.thumb : styles.poster} contentFit={compact ? 'cover' : 'contain'} transition={150} />
        {compact ? (
          <View style={styles.zoomIcon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Ionicons name="expand" size={12} color="#fff" />
          </View>
        ) : (
          <View style={styles.zoomHint} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Ionicons name="expand" size={14} color="#fff" />
            <Text style={styles.zoomText}>แตะดูเต็ม</Text>
          </View>
        )}
      </Pressable>
      <View style={[styles.body, compact && { flex: 1 }]}>
        <View style={styles.pill}>
          <Ionicons name="megaphone" size={13} color={Colors.warning} />
          <Text style={styles.pillText}>ประกาศ</Text>
        </View>
        <Text style={styles.message} numberOfLines={width || compact ? 3 : undefined}>
          {broadcast.message}
        </Text>
        <Text style={styles.meta} numberOfLines={2}>
          {meta(broadcast)}
        </Text>
      </View>

      <Modal visible={viewing} transparent animationType="fade" onRequestClose={() => setViewing(false)}>
        <View style={styles.viewer}>
          <Image source={{ uri }} style={styles.viewerImage} contentFit="contain" accessibilityLabel={`โปสเตอร์ ${broadcast.message}`} />
          <Pressable
            onPress={() => setViewing(false)}
            style={styles.close}
            accessibilityRole="button"
            accessibilityLabel="ปิดโปสเตอร์"
            hitSlop={8}>
            <Ionicons name="close" size={26} color="#fff" />
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

/**
 * รายการประกาศบนหน้าแรก: โปสเตอร์แสดงเป็นการ์ดย่อ (รูปเล็กซ้าย ข้อความขวา) สูงพอๆ กับแถบประกาศข้อความ
 * หลายใบเรียงแนวนอนเลื่อนได้ · แตะรูปเพื่อดูเต็มจอ · ประกาศข้อความล้วนแสดงเป็นแถบด้านล่าง
 */
export function BroadcastList({ items }: { items: Broadcast[] }) {
  if (items.length === 0) return null;
  const posters = items.filter((b) => b.imageUrl);
  const texts = items.filter((b) => !b.imageUrl);
  return (
    <View style={{ gap: Spacing.sm }}>
      {posters.length === 1 ? <BroadcastCard broadcast={posters[0]} compact /> : null}
      {posters.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {posters.map((b) => (
            <BroadcastCard key={b.id} broadcast={b} width={300} compact />
          ))}
        </ScrollView>
      ) : null}
      {texts.map((b) => (
        <BroadcastCard key={b.id} broadcast={b} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  cardRow: { flexDirection: 'row' },
  posterWrap: { backgroundColor: POSTER_BG },
  thumb: { width: 96, height: 128 },
  // โปสเตอร์แนวตั้ง 3:4 แต่จอกว้างไม่ให้สูงเกิน ดูทั้งใบได้ด้วย contain
  poster: { width: '100%', aspectRatio: 3 / 4, maxHeight: 420 },
  zoomHint: {
    position: 'absolute',
    right: Spacing.sm,
    bottom: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  zoomIcon: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: Radius.pill,
    padding: 4,
  },
  zoomText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  body: { padding: Spacing.md, gap: 6 },
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.warningSoft,
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  pillText: { color: Colors.warning, fontSize: 12, fontWeight: '700' },
  message: { fontSize: 15, fontWeight: '600', color: Colors.text, lineHeight: 21 },
  meta: { fontSize: 13, color: Colors.textMuted, lineHeight: 18 },
  row: { gap: Spacing.md, paddingVertical: 2 },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  viewerImage: { width: '100%', height: '100%', maxWidth: 900 },
  close: {
    position: 'absolute',
    top: Spacing.xxl,
    right: Spacing.lg,
    width: MinTouch,
    height: MinTouch,
    borderRadius: MinTouch / 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
