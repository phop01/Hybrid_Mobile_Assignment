// ผู้จัดดูรายชื่อผู้เข้าร่วม และตรวจหลักฐานใบเซ็นชื่อ (ผ่าน / ไม่ผ่านพร้อมเหตุผล)
// แทนที่ "ผู้จัดจำลอง" ของ Assignment 11: ตอนนี้มีคนตรวจจริงในแอป

import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';

import { AnnouncementComposer, AnnouncementList } from '@/components/announcements';
import { StatusBadge } from '@/components/status-badge';
import { Banner, Button, Card, Chip, ChipBar, InfoRow, Screen, SectionTitle, StateView, TextField } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { firstParam } from '@/hooks/use-activity';
import { useActivityAnnouncements, useAttendees } from '@/hooks/use-organizer';
import { formatDateRange, formatTime, formatVenueDistance } from '@/lib/format';
import { PHOTO_SOURCE_LABEL } from '@/lib/photo-time';
import { toAbsoluteUrl } from '@/services/api-config';
import { useActivities } from '@/state/activities-context';
import type { Registration, RegistrationStatus } from '@/types/models';

type Filter = 'all' | RegistrationStatus;
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'pending_review', label: 'รอตรวจ' },
  { key: 'checked_in', label: 'เข้าร่วมแล้ว' },
  { key: 'registered', label: 'ยังไม่เช็กอิน' },
];
const REJECT_REASONS = ['ไม่พบชื่อในใบเซ็นชื่อ', 'รูปไม่ชัด อ่านไม่ออก', 'ไม่ใช่ใบเซ็นชื่อของกิจกรรมนี้'];

export default function OrganizerActivityScreen() {
  const id = firstParam(useLocalSearchParams<{ id?: string | string[] }>().id);
  const { getById } = useActivities();
  const activity = id ? getById(id) : undefined;
  const { data: attendees, loading, error, reload, review } = useAttendees(id);
  const [filter, setFilter] = useState<Filter>('all');
  const announcements = useActivityAnnouncements(id);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: attendees.length, pending_review: 0, checked_in: 0, registered: 0, cancelled: 0 };
    for (const r of attendees) c[r.status] += 1;
    return c;
  }, [attendees]);
  const pending = attendees.filter((r) => r.status === 'pending_review');
  const visible = filter === 'all' ? attendees : attendees.filter((r) => r.status === filter);

  if (!id) return <StateView kind="empty" title="ไม่พบกิจกรรม" actionLabel="กลับ" onAction={() => router.back()} />;

  return (
    <Screen refreshControl={<RefreshControl refreshing={loading && attendees.length > 0} onRefresh={reload} tintColor={Colors.primary} />}>
      {activity ? (
        <Card>
          <Text style={styles.title} accessibilityRole="header">
            {activity.title}
          </Text>
          <InfoRow icon="time-outline">
            {formatDateRange(activity.startsAt, activity.endsAt)} · {activity.hours} ชม.
          </InfoRow>
          <InfoRow icon="location-outline">
            {activity.location.name} (รัศมี {activity.location.radiusM} ม.)
          </InfoRow>
          <InfoRow icon="people-outline">
            ลงทะเบียน {counts.all}/{activity.capacity} · เข้าร่วมแล้ว {counts.checked_in} · รอตรวจ {counts.pending_review}
          </InfoRow>
          <Button
            title="ดูหน้ากิจกรรมแบบที่นักศึกษาเห็น"
            variant="ghost"
            icon="eye-outline"
            onPress={() => router.push({ pathname: '/activities/[id]', params: { id: activity.id } })}
          />
        </Card>
      ) : null}

      {error ? <Banner tone="danger">{error}</Banner> : null}

      <Card>
        <SectionTitle>แจ้งเตือนผู้ลงทะเบียน</SectionTitle>
        <AnnouncementComposer onSend={announcements.send} />
        <AnnouncementList items={announcements.data.slice(0, 3)} />
      </Card>

      {pending.length > 0 ? (
        <>
          <SectionTitle>หลักฐานรอตรวจ ({pending.length})</SectionTitle>
          <Text style={styles.muted}>เทียบรูปกับใบเซ็นชื่อกระดาษ ผ่านแล้วนักศึกษาได้ชั่วโมงทันทีและได้รับแจ้งเตือน</Text>
          {pending.map((r) => (
            <ReviewCard key={r.id} registration={r} onReview={review} />
          ))}
        </>
      ) : null}

      <SectionTitle>รายชื่อผู้ลงทะเบียน</SectionTitle>
      <ChipBar options={FILTERS.map((f) => ({ key: f.key, label: `${f.label} (${counts[f.key]})` }))} value={filter} onChange={setFilter} />
      {loading && attendees.length === 0 ? (
        <StateView kind="loading" message="กำลังโหลดรายชื่อ…" />
      ) : visible.length === 0 ? (
        <StateView kind="empty" icon="people-outline" title={attendees.length === 0 ? 'ยังไม่มีผู้ลงทะเบียน' : 'ไม่มีรายการในสถานะนี้'} />
      ) : (
        <Card>
          {visible.map((r, i) => (
            <View key={r.id} style={[styles.person, i > 0 && styles.divider]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.name}>{r.form.fullName}</Text>
                <Text style={styles.muted}>
                  {r.form.studentId} · {r.form.faculty}
                </Text>
                {r.checkIn ? (
                  <Text style={styles.muted}>
                    ส่งหลักฐาน {formatTime(r.checkIn.takenAt)} · {formatVenueDistance(r.checkIn.distanceM)}
                  </Text>
                ) : r.reviewNote ? (
                  <Text style={[styles.muted, { color: Colors.danger }]}>ไม่ผ่าน: {r.reviewNote} (รอส่งใหม่)</Text>
                ) : null}
              </View>
              <StatusBadge status={r.status} />
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}

function ReviewCard({
  registration,
  onReview,
}: {
  registration: Registration;
  onReview: (id: string, decision: { approve: true } | { approve: false; note: string }) => Promise<unknown>;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const record = registration.checkIn!;

  const decide = async (decision: { approve: true } | { approve: false; note: string }) => {
    setBusy(true);
    setError(null);
    try {
      await onReview(registration.id, decision);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกผลตรวจไม่สำเร็จ');
      setBusy(false);
    }
  };

  return (
    <Card>
      <Text style={styles.name}>
        {registration.form.fullName} ({registration.form.studentId})
      </Text>
      <Image
        source={{ uri: toAbsoluteUrl(record.photoUrl) }}
        style={styles.photo}
        contentFit="contain"
        accessibilityLabel={`รูปหลักฐานของ ${registration.form.fullName}`}
      />
      {record.extraPhotos && record.extraPhotos.length > 0 ? (
        <View style={styles.chipsWrap}>
          {record.extraPhotos.map((url, i) => (
            <Image
              key={url}
              source={{ uri: toAbsoluteUrl(url) }}
              style={styles.extra}
              contentFit="cover"
              accessibilityLabel={`รูปเพิ่มเติมที่ ${i + 1} ของ ${registration.form.fullName}`}
            />
          ))}
        </View>
      ) : null}
      <Text style={styles.muted}>
        {PHOTO_SOURCE_LABEL[record.photoSource ?? 'camera']} · ถ่ายเมื่อ {formatTime(record.takenAt)} · {formatVenueDistance(record.distanceM)}
      </Text>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {rejecting ? (
        <View style={{ gap: Spacing.sm }}>
          <View style={styles.chipsWrap}>
            {REJECT_REASONS.map((r) => (
              <Chip key={r} label={r} selected={note === r} onPress={() => setNote(r)} />
            ))}
          </View>
          <TextField label="เหตุผลที่ไม่ผ่าน (นักศึกษาจะเห็นข้อความนี้)" value={note} onChangeText={setNote} maxLength={200} />
          <View style={styles.actions}>
            <View style={styles.flex}>
              <Button title="ยกเลิก" variant="secondary" onPress={() => setRejecting(false)} disabled={busy} />
            </View>
            <View style={styles.flex}>
              <Button
                title="ยืนยันไม่ผ่าน"
                variant="danger"
                loading={busy}
                disabled={note.trim().length < 3}
                onPress={() => decide({ approve: false, note: note.trim() })}
              />
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.actions}>
          <View style={styles.flex}>
            <Button title="ไม่ผ่าน" icon="close-circle-outline" variant="secondary" onPress={() => setRejecting(true)} disabled={busy} />
          </View>
          <View style={styles.flex}>
            <Button title="ผ่าน" icon="checkmark-circle" loading={busy} onPress={() => decide({ approve: true })} />
          </View>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '800', color: Colors.text, lineHeight: 28 },
  name: { fontSize: 16, fontWeight: '700', color: Colors.text },
  muted: { fontSize: 13, color: Colors.textMuted, lineHeight: 18 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  person: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  divider: { borderTopWidth: 1, borderTopColor: Colors.border },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: Radius.md, backgroundColor: Colors.border },
  extra: { width: 96, height: 96, borderRadius: Radius.md, backgroundColor: Colors.border },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  flex: { flex: 1 },
});
