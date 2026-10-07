// ผู้จัดดูรายชื่อผู้เข้าร่วม ตรวจหลักฐานการเข้าร่วม (ผ่าน / ไม่ผ่านพร้อมเหตุผล) ทุกกิจกรรม
// ไม่รับการลงทะเบียนรายคน และยกเลิกทั้งกิจกรรมได้ (ทุกอย่างต้องมีเหตุผล และอีกฝั่งได้แจ้งเตือน)
// ยกเลิกได้เฉพาะก่อนเริ่มและยังไม่มีใครส่งหลักฐาน · หลังจากนั้นเป็น "จบกิจกรรมตอนนี้" (หลักฐาน/ชั่วโมงไม่หาย)

import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { AnnouncementComposer, AnnouncementList } from '@/components/announcements';
import { StatusBadge } from '@/components/status-badge';
import { HeroCard } from '@/components/hero-card';
import { Banner, Button, Card, Chip, ChipBar, InfoGrid, Screen, SectionTitle, StatPill, StateView, TextField } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { firstParam } from '@/hooks/use-activity';
import { useNow } from '@/hooks/use-now';
import { useActivityAnnouncements, useAttendees } from '@/hooks/use-organizer';
import { formatDateRange, formatTime, formatVenueDistance } from '@/lib/format';
import { confirmAction } from '@/lib/platform-actions';
import { PHOTO_SOURCE_LABEL } from '@/lib/photo-time';
import { toAbsoluteUrl } from '@/services/api-config';
import { useActivities } from '@/state/activities-context';
import type { Registration, RegistrationStatus } from '@/types/models';
import { Text } from '@/components/app-text';

type Filter = 'all' | RegistrationStatus;
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'pending_review', label: 'รอตรวจ' },
  { key: 'checked_in', label: 'เข้าร่วมแล้ว' },
  { key: 'registered', label: 'ยังไม่ส่งหลักฐาน' },
  { key: 'rejected', label: 'ไม่รับ' },
  { key: 'cancelled', label: 'ยกเลิก' },
];
const REJECT_REASONS = ['ไม่พบตัวคุณในรูป', 'รูปไม่เกี่ยวกับกิจกรรมนี้', 'รูปไม่ชัด'];
const REGISTRATION_REJECT_REASONS = ['คุณสมบัติไม่ตรงกับกิจกรรม', 'ข้อมูลลงทะเบียนไม่ถูกต้อง', 'ที่นั่งสำหรับกลุ่มนี้เต็มแล้ว'];
const CANCEL_REASONS = ['สภาพอากาศไม่เอื้ออำนวย', 'วิทยากรติดภารกิจ', 'ผู้ลงทะเบียนไม่ถึงจำนวนขั้นต่ำ'];

export default function OrganizerActivityScreen() {
  const id = firstParam(useLocalSearchParams<{ id?: string | string[] }>().id);
  const { getById } = useActivities();
  const activity = id ? getById(id) : undefined;
  const { data: attendees, loading, error, reload, review, reject, cancelActivity, endActivity } = useAttendees(id);
  const { refresh: refreshActivities } = useActivities();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [ending, setEnding] = useState(false);
  const [endError, setEndError] = useState<string | null>(null);
  const now = useNow();
  const [filter, setFilter] = useState<Filter>('all');
  const announcements = useActivityAnnouncements(id);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: attendees.length, pending_review: 0, checked_in: 0, registered: 0, cancelled: 0, rejected: 0 };
    for (const r of attendees) c[r.status] += 1;
    return c;
  }, [attendees]);
  const pending = attendees.filter((r) => r.status === 'pending_review');
  const visible = filter === 'all' ? attendees : attendees.filter((r) => r.status === filter);

  if (!id) return <StateView kind="empty" title="ไม่พบกิจกรรม" actionLabel="กลับ" onAction={() => router.back()} />;

  return (
    <Screen refreshControl={<RefreshControl refreshing={loading && attendees.length > 0} onRefresh={reload} tintColor={Colors.primary} />}>
      {activity ? (
        <>
          <HeroCard
            imageUrl={activity.imageUrl}
            eyebrow="MANAGE · จัดการกิจกรรม"
            title={activity.title}
            subtitle={`${formatDateRange(activity.startsAt, activity.endsAt)} · ${activity.hours} ชม.`}
            onPress={() => router.push({ pathname: '/activities/[id]', params: { id: activity.id } })}
            actionLabel="ดูหน้ากิจกรรมแบบที่นักศึกษาเห็น">
            <StatPill tone="accent" icon="people" label={`ลงทะเบียน ${counts.all}/${activity.capacity}`} />
            <StatPill tone="dark" icon="checkmark-circle" label={`เข้าร่วม ${counts.checked_in}`} />
            <StatPill tone="dark" icon="hourglass" label={`รอตรวจ ${counts.pending_review}`} />
          </HeroCard>
          <Card>
            <InfoGrid
              items={[{ icon: 'location-outline', label: 'สถานที่', value: activity.location.name }]}
            />
          </Card>
        </>
      ) : null}

      {error ? <Banner tone="danger">{error}</Banner> : null}
      {activity?.cancelledAt ? (
        <Banner tone="danger" icon="close-circle">
          กิจกรรมนี้ถูกยกเลิกแล้ว: {activity.cancelReason}
        </Banner>
      ) : null}

      {activity?.cancelledAt ? null : (
        <Card>
          <SectionTitle>แจ้งเตือนผู้ลงทะเบียน</SectionTitle>
          <AnnouncementComposer onSend={announcements.send} />
          <AnnouncementList items={announcements.data.slice(0, 3)} />
        </Card>
      )}

      {pending.length > 0 ? (
        <>
          <SectionTitle>หลักฐานรอตรวจ ({pending.length})</SectionTitle>
          <Text style={styles.muted}>ดูรูปแล้วกดผ่าน/ไม่ผ่าน ผ่านแล้วนักศึกษาได้ชั่วโมงทันทีและได้รับแจ้งเตือน</Text>
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
            <View key={r.id} style={[styles.personBlock, i > 0 && styles.divider]}>
              <View style={styles.person}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.name}>{r.form.fullName}</Text>
                  <Text style={styles.muted}>
                    {r.form.studentId} · {r.form.faculty}
                  </Text>
                  {r.status === 'rejected' || r.status === 'cancelled' ? (
                    r.reviewNote ? (
                      <Text style={[styles.muted, { color: Colors.danger }]}>
                        {r.status === 'rejected' ? 'ไม่รับ: ' : ''}
                        {r.reviewNote}
                      </Text>
                    ) : null
                  ) : r.checkIn ? (
                    <Text style={styles.muted}>
                      ส่งหลักฐาน {formatTime(r.checkIn.takenAt)} · {formatVenueDistance(r.checkIn.distanceM)}
                    </Text>
                  ) : r.reviewNote ? (
                    <Text style={[styles.muted, { color: Colors.danger }]}>หลักฐานไม่ผ่าน: {r.reviewNote} (รอส่งใหม่)</Text>
                  ) : null}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <StatusBadge status={r.status} />
                  {(r.status === 'registered' || r.status === 'pending_review') && rejectingId !== r.id && !activity?.cancelledAt ? (
                    <Button title="ไม่รับ" variant="ghost" icon="ban" onPress={() => setRejectingId(r.id)} />
                  ) : null}
                </View>
              </View>
              {rejectingId === r.id ? (
                <ReasonForm
                  reasons={REGISTRATION_REJECT_REASONS}
                  label={`เหตุผลที่ไม่รับ ${r.form.fullName} (นักศึกษาจะเห็นข้อความนี้)`}
                  confirmLabel="ยืนยันไม่รับ"
                  onCancel={() => setRejectingId(null)}
                  onConfirm={async (note) => {
                    await reject(r.id, note);
                    setRejectingId(null);
                  }}
                />
              ) : null}
            </View>
          ))}
        </Card>
      )}

      {activity && !activity.cancelledAt && new Date(activity.endsAt).getTime() > now &&
      (new Date(activity.startsAt).getTime() <= now || counts.pending_review + counts.checked_in > 0) ? (
        <Card>
          <SectionTitle>จบกิจกรรม</SectionTitle>
          <Text style={styles.muted}>
            กิจกรรมเริ่มแล้วหรือมีคนส่งหลักฐานแล้ว จึงยกเลิกไม่ได้ จบกิจกรรมตอนนี้ได้ หลักฐานและชั่วโมงที่ตรวจแล้วยังอยู่ครบ
            คนที่ยังไม่ส่งหลักฐานจะได้แจ้งเตือนให้ส่ง
          </Text>
          {endError ? <Banner tone="danger">{endError}</Banner> : null}
          <Button
            title="จบกิจกรรมตอนนี้"
            variant="danger"
            icon="stop-circle-outline"
            loading={ending}
            onPress={async () => {
              const ok = await confirmAction('จบกิจกรรม', `จบ “${activity.title}” ตอนนี้ใช่ไหม? ลงทะเบียนเพิ่มไม่ได้อีก`, 'จบกิจกรรม');
              if (!ok) return;
              setEnding(true);
              setEndError(null);
              try {
                await endActivity();
                await refreshActivities();
              } catch (e) {
                setEndError(e instanceof Error ? e.message : 'จบกิจกรรมไม่สำเร็จ');
              } finally {
                setEnding(false);
              }
            }}
          />
        </Card>
      ) : activity && !activity.cancelledAt && new Date(activity.endsAt).getTime() > now ? (
        <Card>
          <SectionTitle>ยกเลิกกิจกรรม</SectionTitle>
          <Text style={styles.muted}>ทุกคนที่ลงทะเบียนจะได้แจ้งเตือนพร้อมเหตุผล และลงทะเบียนเพิ่มไม่ได้อีก</Text>
          {cancelling ? (
            <ReasonForm
              reasons={CANCEL_REASONS}
              label="เหตุผลที่ยกเลิก (ผู้ลงทะเบียนจะเห็นข้อความนี้)"
              confirmLabel="ยืนยันยกเลิกกิจกรรม"
              onCancel={() => setCancelling(false)}
              onConfirm={async (note) => {
                const ok = await confirmAction('ยกเลิกกิจกรรม', `ยกเลิก “${activity.title}” ใช่ไหม? ทำย้อนกลับไม่ได้`, 'ยกเลิกกิจกรรม');
                if (!ok) return;
                await cancelActivity(note);
                await refreshActivities();
                setCancelling(false);
              }}
            />
          ) : (
            <Button title="ยกเลิกกิจกรรมนี้" variant="danger" icon="close-circle-outline" onPress={() => setCancelling(true)} />
          )}
        </Card>
      ) : null}
    </Screen>
  );
}

/** เลือกเหตุผลสำเร็จรูปหรือพิมพ์เอง แล้วยืนยัน (ใช้กับ ไม่รับการลงทะเบียน / ยกเลิกกิจกรรม) */
function ReasonForm({
  reasons,
  label,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  reasons: string[];
  label: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: (note: string) => Promise<void>;
}) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <View style={{ gap: Spacing.sm }}>
      <View style={styles.chipsWrap}>
        {reasons.map((r) => (
          <Chip key={r} label={r} selected={note === r} onPress={() => setNote(r)} />
        ))}
      </View>
      <TextField label={label} value={note} onChangeText={setNote} maxLength={200} />
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <View style={styles.actions}>
        <View style={styles.flex}>
          <Button title="ไม่ทำแล้ว" variant="secondary" onPress={onCancel} disabled={busy} />
        </View>
        <View style={styles.flex}>
          <Button
            title={confirmLabel}
            variant="danger"
            loading={busy}
            disabled={note.trim().length < 3}
            onPress={async () => {
              setBusy(true);
              setError(null);
              try {
                await onConfirm(note.trim());
              } catch (e) {
                setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
              } finally {
                setBusy(false);
              }
            }}
          />
        </View>
      </View>
    </View>
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
  personBlock: { gap: Spacing.sm, paddingVertical: Spacing.sm },
  person: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  divider: { borderTopWidth: 1, borderTopColor: Colors.border },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: Radius.md, backgroundColor: Colors.border },
  extra: { width: 96, height: 96, borderRadius: Radius.md, backgroundColor: Colors.border },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  flex: { flex: 1 },
});
