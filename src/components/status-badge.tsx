import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius } from '@/constants/theme';
import type { RegistrationStatus } from '@/types/models';

import type { IconName } from './ui';

export type DisplayStatus = RegistrationStatus | 'queued';

const STATUS: Record<DisplayStatus, { label: string; fg: string; bg: string; icon: IconName }> = {
  registered: { label: 'ลงทะเบียนแล้ว', fg: Colors.primaryDark, bg: Colors.primarySoft, icon: 'bookmark' },
  queued: { label: 'รอส่ง (ออฟไลน์)', fg: Colors.warning, bg: Colors.warningSoft, icon: 'cloud-upload' },
  pending_review: { label: 'รอตรวจหลักฐาน', fg: Colors.warning, bg: Colors.warningSoft, icon: 'hourglass' },
  checked_in: { label: 'เข้าร่วมแล้ว', fg: Colors.success, bg: Colors.successSoft, icon: 'checkmark-circle' },
  cancelled: { label: 'ยกเลิกแล้ว', fg: Colors.textMuted, bg: Colors.background, icon: 'close-circle' },
};

export function StatusBadge({ status }: { status: DisplayStatus }) {
  const s = STATUS[status];
  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]} accessibilityLabel={`สถานะ ${s.label}`}>
      <Ionicons name={s.icon} size={14} color={s.fg} />
      <Text style={[styles.text, { color: s.fg }]}>{s.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  text: { fontSize: 12, fontWeight: '700' },
});
