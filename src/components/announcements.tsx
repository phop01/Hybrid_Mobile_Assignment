// ประกาศจากผู้จัด: ผู้จัดส่งจากหน้าจัดการกิจกรรม → แอปนักศึกษาที่ลงทะเบียนไว้เด้งแจ้งเตือนเอง
// ใช้แทนปุ่ม "ทดสอบแจ้งเตือน 10 วิ" เดิม: แจ้งเตือนมาจากคนจริง (ผู้จัด) ไม่ได้กดเองในเครื่อง

import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { formatDate, formatTime } from '@/lib/format';
import type { Announcement } from '@/types/models';

import { Banner, Button, Chip, TextField } from './ui';

const TEMPLATES = [
  'เริ่มกิจกรรมแล้ว ส่งหลักฐานการเข้าร่วมในแอปได้เลย',
  'เปลี่ยนสถานที่จัดกิจกรรม กรุณาดูรายละเอียดในแอป',
  'กิจกรรมเลื่อนเวลาเริ่ม 15 นาที',
];

export function AnnouncementComposer({ onSend }: { onSend: (message: string) => Promise<unknown> }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const trimmed = message.trim();

  const send = async () => {
    setBusy(true);
    setResult(null);
    try {
      await onSend(trimmed);
      setMessage('');
      setResult({ tone: 'success', text: 'ส่งแล้ว ผู้ลงทะเบียนที่เปิดแอปอยู่จะได้รับแจ้งเตือนภายในไม่กี่วินาที' });
    } catch (e) {
      setResult({ tone: 'danger', text: e instanceof Error ? e.message : 'ส่งประกาศไม่สำเร็จ' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: Spacing.sm }}>
      <View style={styles.row}>
        {TEMPLATES.map((t) => (
          <Chip key={t} label={t} selected={message === t} onPress={() => setMessage(t)} />
        ))}
      </View>
      <TextField
        label="ข้อความ (ผู้ลงทะเบียนทุกคนจะได้รับ)"
        value={message}
        onChangeText={setMessage}
        maxLength={200}
        multiline
        placeholder="เช่น เริ่มกิจกรรมแล้ว"
      />
      <Button title="ส่งแจ้งเตือนถึงผู้ลงทะเบียน" icon="megaphone-outline" loading={busy} disabled={trimmed.length === 0} onPress={send} />
      {result ? <Banner tone={result.tone}>{result.text}</Banner> : null}
    </View>
  );
}

export function AnnouncementList({ items }: { items: Announcement[] }) {
  if (items.length === 0) return null;
  return (
    <View style={{ gap: Spacing.sm }}>
      {items.map((a) => (
        <View key={a.id} style={styles.item} accessible accessibilityLabel={`ประกาศ ${formatTime(a.createdAt)} ${a.message}`}>
          <Ionicons name="megaphone" size={18} color={Colors.accent} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.message}>{a.message}</Text>
            <Text style={styles.muted}>
              {formatDate(a.createdAt)} {formatTime(a.createdAt)}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  item: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.accentSoft,
    borderLeftWidth: 4,
    borderLeftColor: Colors.accent,
  },
  message: { fontSize: 15, color: Colors.text, lineHeight: 21 },
  muted: { fontSize: 13, color: Colors.textMuted },
});
