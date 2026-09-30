// "ใช้งานในฐานะ": บัญชีที่มีหลายบทบาท (เช่น บุคลากรที่เรียนต่อด้วย) เลือกบทบาทที่จะใช้ตอนนี้
// แท็บ เมนู และสิทธิ์เปลี่ยนตามบทบาท server ตรวจซ้ำทุก request · บัญชีบทบาทเดียวไม่แสดง

import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, MinTouch, Radius, Spacing } from '@/constants/theme';
import { activeRoleOf, ROLE_INFO, ROLE_ORDER, userRoles } from '@/lib/roles';
import { useSession } from '@/state/session-context';
import type { AccountRole } from '@/types/models';

export function RoleSwitcher() {
  const { session, switchRole } = useSession();
  const [busy, setBusy] = useState<AccountRole | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (session.status !== 'authenticated') return null;
  const roles = ROLE_ORDER.filter((r) => userRoles(session.user).includes(r));
  if (roles.length < 2) return null;
  const current = activeRoleOf(session.user);

  const pick = async (role: AccountRole) => {
    setBusy(role);
    setError(null);
    try {
      await switchRole(role);
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เปลี่ยนบทบาทไม่สำเร็จ');
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>ใช้งานในฐานะ</Text>
      <View style={styles.row}>
        {roles.map((role) => {
          const info = ROLE_INFO[role];
          const selected = role === current;
          return (
            <Pressable
              key={role}
              onPress={() => (selected ? undefined : pick(role))}
              disabled={busy !== null}
              accessibilityRole="radio"
              accessibilityState={{ selected, busy: busy === role }}
              accessibilityLabel={`${selected ? 'ใช้อยู่: ' : 'ใช้งานในฐานะ'}${info.label}`}
              style={({ pressed }) => [styles.role, selected && styles.roleSelected, pressed && { opacity: 0.8 }]}>
              <Ionicons name={info.icon} size={22} color={selected ? Colors.onPrimary : Colors.primary} />
              <Text style={[styles.label, selected && { color: Colors.onPrimary }]}>{busy === role ? 'กำลังเปลี่ยน…' : info.label}</Text>
              <Text style={[styles.detail, selected && { color: Colors.onPrimaryMuted }]} numberOfLines={2}>
                {selected ? 'ใช้อยู่' : info.detail}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm, backgroundColor: Colors.primarySoft, borderRadius: Radius.lg, padding: Spacing.md },
  title: { fontSize: 13, fontWeight: '700', color: Colors.primaryDark },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  role: {
    flexGrow: 1,
    flexBasis: 150,
    minHeight: MinTouch * 2,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
    gap: 2,
  },
  roleSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  label: { fontSize: 15, fontWeight: '700', color: Colors.text },
  detail: { fontSize: 12, color: Colors.textMuted, lineHeight: 16 },
  error: { fontSize: 13, color: Colors.danger },
});
