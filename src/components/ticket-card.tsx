import Ionicons from '@expo/vector-icons/Ionicons';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, MinTouch, Radius, Spacing } from '@/constants/theme';
import { formatDistance, formatUpdatedAt } from '@/lib/format';
import { categoryInfo, KIND_INFO, statusLabel, statusTone, type StatusTone } from '@/lib/tickets';
import type { Ticket, TicketKind, TicketStatus } from '@/types/models';

import type { IconName } from './ui';

const TONES: Record<StatusTone, { fg: string; bg: string; icon: IconName }> = {
  warning: { fg: Colors.warning, bg: Colors.warningSoft, icon: 'hourglass' },
  info: { fg: Colors.primaryDark, bg: Colors.primarySoft, icon: 'sync' },
  success: { fg: Colors.success, bg: Colors.successSoft, icon: 'checkmark-circle' },
  danger: { fg: Colors.danger, bg: Colors.dangerSoft, icon: 'close-circle' },
  muted: { fg: Colors.textMuted, bg: Colors.background, icon: 'remove-circle' },
};

/** สถานะเรื่อง: ไอคอน + ข้อความ + สี (ไม่สื่อด้วยสีอย่างเดียว) */
export function TicketStatusBadge({ kind, status }: { kind: TicketKind; status: TicketStatus }) {
  const tone = TONES[statusTone(status)];
  const label = statusLabel({ kind, status });
  return (
    <View style={[styles.badge, { backgroundColor: tone.bg }]} accessibilityLabel={`สถานะ ${label}`}>
      <Ionicons name={tone.icon} size={14} color={tone.fg} />
      <Text style={[styles.badgeText, { color: tone.fg }]}>{label}</Text>
    </View>
  );
}

export function KindBadge({ kind }: { kind: TicketKind }) {
  const info = KIND_INFO[kind];
  return (
    <View style={[styles.badge, { backgroundColor: info.soft }]}>
      <Ionicons name={info.icon} size={14} color={info.color} />
      <Text style={[styles.badgeText, { color: info.color }]}>{info.label}</Text>
    </View>
  );
}

type Props = {
  ticket: Ticket;
  onOpen: (id: string) => void;
  /** ระยะจากผู้ใช้ (ถ้ารู้ตำแหน่ง) */
  distance?: number | null;
};

/**
 * การ์ดเรื่องแจ้งซ่อม ใช้ทั้งหน้าแรก รายการ และแผนที่
 * memo: รายการยาวไม่ต้องวาดการ์ดใหม่ทุกครั้งที่ poll ได้ข้อมูลชุดเดิม
 */
export const TicketCard = memo(function TicketCard({ ticket, onOpen, distance }: Props) {
  const kind = KIND_INFO[ticket.kind];
  const category = categoryInfo(ticket.kind, ticket.category);
  const label = `${kind.label} ${category.label}: ${ticket.title}, ที่ ${ticket.location.name}, ${statusLabel(ticket)}${
    ticket.followerCount > 0 ? `, มีคนเจอเหมือนกัน ${ticket.followerCount} คน` : ''
  }`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="แตะเพื่อดูรายละเอียดและความคืบหน้า"
      onPress={() => onOpen(ticket.id)}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}>
      <View style={[styles.icon, { backgroundColor: kind.soft }]}>
        <Ionicons name={category.icon} size={22} color={kind.color} />
      </View>
      <View style={styles.body}>
        <View style={styles.row}>
          <Text style={[styles.kind, { color: kind.color }]}>{category.label}</Text>
          <Text style={styles.time}>{formatUpdatedAt(ticket.createdAt)}</Text>
        </View>
        <Text style={styles.title} numberOfLines={2}>
          {ticket.title}
        </Text>
        <Text style={styles.place} numberOfLines={1}>
          <Ionicons name="location-outline" size={13} color={Colors.textMuted} /> {ticket.location.name}
          {distance !== undefined && distance !== null ? ` · ห่าง ${formatDistance(distance)}` : ''}
        </Text>
        <View style={styles.row}>
          <TicketStatusBadge kind={ticket.kind} status={ticket.status} />
          {ticket.followerCount > 0 ? (
            <Text style={styles.followers}>
              <Ionicons name="people" size={13} color={Colors.textMuted} /> เจอเหมือนกัน {ticket.followerCount}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    minHeight: MinTouch,
  },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm, flexWrap: 'wrap' },
  kind: { fontSize: 13, fontWeight: '700' },
  time: { fontSize: 12, color: Colors.textMuted },
  title: { fontSize: 16, fontWeight: '700', color: Colors.text },
  place: { fontSize: 13, color: Colors.textMuted },
  followers: { fontSize: 13, color: Colors.textMuted },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  badgeText: { fontSize: 12, fontWeight: '700' },
});
