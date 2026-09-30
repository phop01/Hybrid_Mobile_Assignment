import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { targetFor } from '@/lib/inbox';
import { useInbox } from '@/state/inbox-context';

const SHOW_MS = 6000;

/**
 * แถบแจ้งเตือนในแอปสำหรับเว็บ (เว็บไม่มีแจ้งเตือนของระบบ)
 * บนมือถือระบบแสดง banner ให้อยู่แล้ว จึงไม่แสดงซ้ำ
 * เช่น เจ้าหน้าที่เปิดบนเว็บ เห็นทันทีว่ามีเรื่องแจ้งซ่อมใหม่
 */
export function InboxToast() {
  const { latest, dismissLatest } = useInbox();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!latest) return;
    const timer = setTimeout(dismissLatest, SHOW_MS);
    return () => clearTimeout(timer);
  }, [latest, dismissLatest]);

  if (Platform.OS !== 'web' || !latest) return null;

  const open = () => {
    const target = targetFor(latest.kind, latest.targetId);
    dismissLatest();
    if (target) router.push(target as never);
  };

  return (
    <View style={[styles.wrap, { top: insets.top + Spacing.sm }]} pointerEvents="box-none">
      <Pressable
        onPress={open}
        style={styles.toast}
        accessibilityRole="alert"
        accessibilityLabel={`แจ้งเตือนใหม่: ${latest.title}. ${latest.body}`}
        accessibilityHint="แตะเพื่อเปิด">
        <Ionicons name="notifications" size={22} color={Colors.onPrimary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            {latest.title}
          </Text>
          <Text style={styles.body} numberOfLines={2}>
            {latest.body}
          </Text>
        </View>
        <Pressable onPress={dismissLatest} accessibilityRole="button" accessibilityLabel="ปิดแจ้งเตือน" hitSlop={12}>
          <Ionicons name="close" size={20} color={Colors.onPrimaryMuted} />
        </Pressable>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: Spacing.md },
  toast: {
    width: '100%',
    maxWidth: Math.min(520, MaxContentWidth),
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.primaryDark,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  title: { color: Colors.onPrimary, fontWeight: '700', fontSize: 15 },
  body: { color: Colors.onPrimaryMuted, fontSize: 13, lineHeight: 18 },
});
