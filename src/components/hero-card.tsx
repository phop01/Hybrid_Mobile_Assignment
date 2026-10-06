import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/app-text';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { toAbsoluteUrl } from '@/services/api-config';

/**
 * การ์ดใหญ่หัวหน้า: รูปเต็มการ์ด + ม่านเข้มให้ตัวหนังสือขาวอ่านได้ · ไม่มีรูปใช้พื้นสีเข้มของแอป
 * ล่างขวามีปุ่มลูกศรวงกลมไปทำต่อ (ถ้าส่ง onPress)
 */
export function HeroCard({
  imageUrl,
  tag,
  eyebrow,
  title,
  subtitle,
  children,
  onPress,
  actionLabel,
}: {
  imageUrl?: string | null;
  tag?: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  /** ป้ายตัวเลขสรุป (StatPill tone="dark") */
  children?: ReactNode;
  onPress?: () => void;
  actionLabel?: string;
}) {
  return (
    <View style={[styles.hero, !tag && styles.noTag]}>
      {imageUrl ? (
        <>
          <Image
            source={{ uri: toAbsoluteUrl(imageUrl) }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            // รูปปกส่วนใหญ่เป็นโปสเตอร์มีตัวหนังสือ เบลอไว้ให้หัวข้อบนการ์ดอ่านง่าย ไม่ตีกัน
            blurRadius={14}
            transition={200}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.scrim }]} />
        </>
      ) : (
        <Ionicons name="sparkles" size={120} color={Colors.primary} style={styles.deco} />
      )}
      {tag ? (
        <View style={styles.tag}>
          <Ionicons name="location" size={13} color={Colors.primary} />
          <Text style={styles.tagText}>{tag}</Text>
        </View>
      ) : null}
      <View style={{ gap: Spacing.sm }}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        <View style={styles.bottom}>
          <View style={{ flex: 1, gap: Spacing.sm }}>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            {children ? <View style={styles.pills}>{children}</View> : null}
          </View>
          {onPress ? (
            <Pressable
              onPress={onPress}
              accessibilityRole="button"
              accessibilityLabel={actionLabel ?? title}
              style={({ pressed }) => [styles.arrow, pressed && { opacity: 0.85 }]}>
              <Ionicons name="arrow-forward" size={20} color={Colors.ink} style={{ transform: [{ rotate: '-45deg' }] }} />
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    minHeight: 165,
    borderRadius: Radius.xxl,
    overflow: 'hidden',
    padding: Spacing.lg,
    justifyContent: 'space-between',
    gap: Spacing.lg,
    backgroundColor: Colors.ink,
  },
  // ไม่มีป้ายด้านบน → ชิดล่าง ไม่เหลือช่องว่างกลางการ์ด
  noTag: { minHeight: 130, justifyContent: 'flex-end' },
  deco: { position: 'absolute', right: -24, top: -16, opacity: 0.4 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  tagText: { fontSize: 12, fontWeight: '600', color: Colors.text },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 2, color: Colors.highlight },
  title: { fontSize: 20, lineHeight: 28, fontWeight: '800', color: Colors.onPrimary },
  subtitle: { fontSize: 14, lineHeight: 20, color: 'rgba(255,255,255,0.88)' },
  bottom: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.md },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  arrow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.highlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
