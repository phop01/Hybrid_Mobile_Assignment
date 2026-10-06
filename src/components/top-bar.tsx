import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/app-text';
import { Avatar } from '@/components/avatar';
import { Colors, Spacing } from '@/constants/theme';
import { useAuthenticatedSession } from '@/state/session-context';

/**
 * หัวหน้าแท็บแบบไม่มีแถบหัวของระบบ: คำเล็กบอกส่วน + หัวข้อใหญ่ + คำอธิบาย · ขวาเป็นรูปโปรไฟล์ (แตะไปแท็บ "ฉัน")
 * เผื่อพื้นที่ notch เอง เพราะหน้าที่ใช้ตัวนี้ซ่อน header ของแท็บ
 */
export function TopBar({ eyebrow, title, subtitle, right }: { eyebrow: string; title: string; subtitle?: string; right?: ReactNode }) {
  const insets = useSafeAreaInsets();
  const user = useAuthenticatedSession()?.user;
  return (
    <View style={[styles.bar, { paddingTop: insets.top + Spacing.sm }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right ??
        (user ? (
          <Pressable
            onPress={() => router.navigate('/profile')}
            accessibilityRole="button"
            accessibilityLabel="เปิดโปรไฟล์"
            style={({ pressed }) => [styles.avatar, pressed && { opacity: 0.8 }]}>
            <Avatar name={user.fullName} url={user.avatarUrl} size={46} />
          </Pressable>
        ) : (
          <Pressable
            onPress={() => router.push('/login')}
            accessibilityRole="button"
            accessibilityLabel="เข้าสู่ระบบ"
            style={({ pressed }) => [styles.login, pressed && { opacity: 0.8 }]}>
            <Text style={styles.loginText}>เข้าสู่ระบบ</Text>
          </Pressable>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.8, color: Colors.textMuted },
  title: { fontSize: 22, fontWeight: '800', color: Colors.text },
  subtitle: { fontSize: 13, color: Colors.textMuted, lineHeight: 19 },
  avatar: { borderRadius: 26, borderWidth: 2, borderColor: Colors.highlight, padding: 1 },
  login: { backgroundColor: Colors.ink, borderRadius: 999, paddingHorizontal: 16, minHeight: 42, justifyContent: 'center' },
  loginText: { color: Colors.highlight, fontWeight: '700', fontSize: 14 },
});
