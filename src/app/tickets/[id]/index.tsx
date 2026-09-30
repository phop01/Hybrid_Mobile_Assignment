// รายละเอียดเรื่อง: สถานะ รูปก่อน/หลัง ตำแหน่ง ไทม์ไลน์ และปุ่มตามบทบาท
// เปิดได้จากรายการ แผนที่ แจ้งเตือน และ deep link nktoday://tickets/<id>

import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppointmentPicker } from '@/components/appointment-picker';
import { PickMap } from '@/components/pick-map';
import { KindBadge, TicketStatusBadge } from '@/components/ticket-card';
import { NavigateButtons } from '@/components/navigate-buttons';
import { Banner, Button, Card, InfoRow, Screen, SectionTitle, StateView, TextField } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useRefreshControl } from '@/hooks/use-refresh-control';
import { formatDate, formatTime, formatUpdatedAt } from '@/lib/format';
import { confirmAction } from '@/lib/platform-actions';
import { availableActions, categoryInfo, eventLabel, KIND_INFO } from '@/lib/tickets';
import { ApiError } from '@/services/api-client';
import { toAbsoluteUrl } from '@/services/api-config';
import type { TicketAction } from '@/services/tickets-api';
import { useAuthenticatedSession } from '@/state/session-context';
import { useTickets } from '@/state/tickets-context';

type Panel = null | 'accept' | 'schedule' | 'reopen' | 'reject';

export default function TicketDetailScreen() {
  const { id: rawId } = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const session = useAuthenticatedSession();
  const { getById, load, act } = useTickets();
  const ticket = id ? getById(id) : undefined;
  // ลิงก์ไม่มี id → แสดง "ไม่พบเรื่องนี้" ทันที ไม่ค้างหน้าโหลด
  const [loading, setLoading] = useState(!ticket && Boolean(id));
  const [notFound, setNotFound] = useState(!id);
  const [panel, setPanel] = useState<Panel>(null);
  const [appointment, setAppointment] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  // เปิดจากแจ้งเตือน/deep link: ข้อมูลในเครื่องอาจเก่า โหลดล่าสุดจาก server เสมอ
  // id ไม่ถูกต้อง/ถูกลบ → server ตอบ 404 → แสดงหน้า "ไม่พบเรื่องนี้"
  const reload = () =>
    id
      ? load(id)
          .then(() => setNotFound(false))
          .catch((e: unknown) => {
            if (e instanceof ApiError && e.status === 404) setNotFound(true);
          })
          .finally(() => setLoading(false))
      : Promise.resolve();

  const refreshControl = useRefreshControl(reload);

  useEffect(() => {
    reload();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ticket) {
    if (loading) return <StateView kind="loading" />;
    return (
      <StateView
        kind={notFound ? 'empty' : 'error'}
        icon="search-outline"
        title={notFound ? 'ไม่พบเรื่องนี้' : 'โหลดไม่สำเร็จ'}
        message={notFound ? 'เรื่องอาจถูกลบไปแล้ว หรือลิงก์ไม่ถูกต้อง' : 'ตรวจอินเทอร์เน็ตแล้วลองใหม่'}
        actionLabel="ไปหน้าเรื่องแจ้ง"
        onAction={() => router.replace('/tickets')}
      />
    );
  }

  const user = session?.user;
  const buttons = user ? availableActions(ticket, user) : [];
  const kind = KIND_INFO[ticket.kind];
  const category = categoryInfo(ticket.kind, ticket.category);

  const run = async (action: TicketAction, success: string) => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await act(ticket.id, action);
      setPanel(null);
      setNote('');
      // ไม่ให้เวลานัดครั้งก่อนติดไปกับแผง "เลื่อนเวลานัด" ครั้งถัดไป
      setAppointment(null);
      setMessage({ tone: 'success', text: success });
    } catch (e) {
      setMessage({ tone: 'danger', text: e instanceof Error ? e.message : 'ทำรายการไม่สำเร็จ' });
      // 409 = สถานะเปลี่ยนไปแล้ว (เช่น มีคนรับเรื่องก่อน) → โหลดใหม่ให้เห็นสถานะจริง
      if (e instanceof ApiError && e.status === 409) reload();
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    const ok = await confirmAction('ยกเลิกเรื่องนี้?', 'ผู้ที่รับเรื่องไว้จะได้แจ้งเตือนว่าไม่ต้องไปแล้ว', 'ยกเลิกเรื่อง');
    if (ok) run({ type: 'cancel' }, 'ยกเลิกเรื่องแล้ว');
  };

  const release = async () => {
    const ok = await confirmAction('คืนเรื่องนี้?', 'ผู้แจ้งจะได้แจ้งเตือน และคนอื่นรับเรื่องต่อได้', 'คืนเรื่อง');
    if (ok) run({ type: 'release' }, 'คืนเรื่องแล้ว');
  };

  const nameOf = (userId: string) =>
    userId === ticket.reporterId ? ticket.reporterName : userId === ticket.assigneeId ? (ticket.assigneeName ?? 'ผู้รับเรื่อง') : 'ผู้ใช้';

  return (
    <Screen refreshControl={refreshControl}>
      <Card>
        <View style={styles.badges}>
          <KindBadge kind={ticket.kind} />
          <TicketStatusBadge kind={ticket.kind} status={ticket.status} />
        </View>
        <Text style={styles.title} accessibilityRole="header">
          {ticket.title}
        </Text>
        <InfoRow icon={category.icon}>{category.label}</InfoRow>
        <InfoRow icon="location-outline">{ticket.location.name}</InfoRow>
        <InfoRow icon="person-outline">
          แจ้งโดย {ticket.reporterName} · {formatUpdatedAt(ticket.createdAt)}
        </InfoRow>
        {ticket.assigneeName ? (
          <InfoRow icon="construct-outline">
            ผู้รับผิดชอบ: {ticket.assigneeName}
          </InfoRow>
        ) : null}
        {ticket.appointmentAt && ticket.status === 'accepted' ? (
          <Banner tone="info" icon="calendar">
            นัดเข้าซ่อม {formatDate(ticket.appointmentAt)} {formatTime(ticket.appointmentAt)} · แอปจะเตือนก่อน 1 ชั่วโมง
          </Banner>
        ) : null}
        {ticket.followerCount > 0 ? (
          <InfoRow icon="people-outline">มีคนเจอปัญหาเดียวกันอีก {ticket.followerCount} คน</InfoRow>
        ) : null}
        {ticket.detail ? <Text style={styles.detail}>{ticket.detail}</Text> : null}
        {ticket.note && (ticket.status === 'rejected' || ticket.status === 'done' || ticket.status === 'confirmed') ? (
          <Banner tone={ticket.status === 'rejected' ? 'danger' : 'info'}>{ticket.note}</Banner>
        ) : null}
      </Card>

      {message ? <Banner tone={message.tone}>{message.text}</Banner> : null}

      {buttons.length > 0 ? (
        <Card>
          <SectionTitle>{ticket.status === 'done' ? 'เรียบร้อยจริงไหม?' : 'สิ่งที่คุณทำได้'}</SectionTitle>
          {buttons.includes('accept') ? (
            panel === 'accept' ? (
              <>
                <Text style={styles.muted}>เลือกเวลานัดเข้าซ่อม (ไม่บังคับ นัดทีหลังได้) ผู้แจ้งจะได้แจ้งเตือนพร้อมเวลานัด</Text>
                <AppointmentPicker onChange={setAppointment} />
                <Button
                  title="ยืนยันรับเรื่อง"
                  icon="checkmark-circle"
                  loading={busy}
                  onPress={() => run({ type: 'accept', appointmentAt: appointment }, 'รับเรื่องแล้ว ผู้แจ้งได้รับแจ้งเตือน')}
                />
              </>
            ) : (
              <Button
                title="รับเรื่องนี้"
                icon="construct"
                loading={busy}
                onPress={() => setPanel('accept')}
              />
            )
          ) : null}
          {buttons.includes('done') ? (
            <Button
              title="ซ่อมเสร็จแล้ว"
              icon="checkmark-done"
              onPress={() => router.push({ pathname: '/tickets/[id]/done', params: { id: ticket.id } })}
            />
          ) : null}
          {buttons.includes('schedule') ? (
            panel === 'schedule' ? (
              <>
                <AppointmentPicker onChange={setAppointment} />
                <Button
                  title="บันทึกเวลานัด"
                  icon="calendar"
                  disabled={!appointment}
                  loading={busy}
                  onPress={() => appointment && run({ type: 'schedule', appointmentAt: appointment }, 'นัดเวลาแล้ว ผู้แจ้งได้รับแจ้งเตือน')}
                />
              </>
            ) : (
              <Button title={ticket.appointmentAt ? 'เลื่อนเวลานัด' : 'นัดเวลาเข้าซ่อม'} icon="calendar-outline" variant="secondary" onPress={() => setPanel('schedule')} />
            )
          ) : null}
          {buttons.includes('confirm') ? (
            <Button
              title="ยืนยัน ซ่อมเรียบร้อยแล้ว"
              icon="happy"
              loading={busy}
              onPress={() => run({ type: 'confirm' }, 'ขอบคุณที่ยืนยัน ปิดเรื่องแล้ว')}
            />
          ) : null}
          {buttons.includes('reopen') || buttons.includes('reject') ? (
            panel === 'reopen' || panel === 'reject' ? (
              <>
                <TextField
                  label={panel === 'reopen' ? 'ยังไม่เรียบร้อยตรงไหน *' : 'เหตุผลที่ไม่ดำเนินการ *'}
                  value={note}
                  onChangeText={setNote}
                  maxLength={300}
                  placeholder={panel === 'reopen' ? 'เช่น ไฟยังกะพริบอยู่' : 'เช่น เป็นพื้นที่ของเทศบาล แจ้งต่อให้แล้ว'}
                />
                <Button
                  title={panel === 'reopen' ? 'ส่งกลับให้ทำต่อ' : 'ไม่ดำเนินการ'}
                  icon="arrow-undo"
                  variant="danger"
                  disabled={note.trim().length < 3}
                  loading={busy}
                  onPress={() =>
                    run(
                      panel === 'reopen' ? { type: 'reopen', note } : { type: 'reject', note },
                      panel === 'reopen' ? 'ส่งกลับแล้ว ผู้รับเรื่องได้รับแจ้งเตือน' : 'บันทึกแล้ว ผู้แจ้งได้รับแจ้งเตือนพร้อมเหตุผล',
                    )
                  }
                />
              </>
            ) : (
              <Button
                title={buttons.includes('reopen') ? 'ยังไม่เรียบร้อย' : 'ไม่ดำเนินการ (ระบุเหตุผล)'}
                icon="alert-circle-outline"
                variant="ghost"
                onPress={() => setPanel(buttons.includes('reopen') ? 'reopen' : 'reject')}
              />
            )
          ) : null}
          {buttons.includes('follow') || buttons.includes('unfollow') ? (
            <Button
              title={buttons.includes('follow') ? 'เจอเหมือนกัน (ติดตามเรื่องนี้)' : 'เลิกติดตาม'}
              icon={buttons.includes('follow') ? 'people' : 'people-outline'}
              variant="secondary"
              loading={busy}
              onPress={() =>
                run({ type: 'follow' }, buttons.includes('follow') ? 'ติดตามแล้ว จะได้แจ้งเตือนเมื่อมีความคืบหน้า' : 'เลิกติดตามแล้ว')
              }
            />
          ) : null}
          {buttons.includes('release') ? <Button title="คืนเรื่อง (ไปไม่ได้แล้ว)" icon="return-down-back" variant="ghost" onPress={release} /> : null}
          {buttons.includes('cancel') ? <Button title="ยกเลิกเรื่องนี้" icon="close-circle-outline" variant="ghost" onPress={cancel} /> : null}
        </Card>
      ) : null}

      {ticket.photoUrl || ticket.afterPhotoUrl ? (
        <Card>
          <SectionTitle>{ticket.afterPhotoUrl ? 'รูปก่อน / หลัง' : 'รูป'}</SectionTitle>
          <View style={styles.photos}>
            {ticket.photoUrl ? (
              <View style={styles.photoCell}>
                <Image source={{ uri: toAbsoluteUrl(ticket.photoUrl) }} style={styles.photo} contentFit="cover" accessibilityLabel="รูปตอนแจ้ง" />
                <Text style={styles.muted}>ตอนแจ้ง</Text>
              </View>
            ) : null}
            {ticket.afterPhotoUrl ? (
              <View style={styles.photoCell}>
                <Image
                  source={{ uri: toAbsoluteUrl(ticket.afterPhotoUrl) }}
                  style={styles.photo}
                  contentFit="cover"
                  accessibilityLabel="รูปหลังซ่อม"
                />
                <Text style={styles.muted}>หลังซ่อม</Text>
              </View>
            ) : null}
          </View>
        </Card>
      ) : null}

      <Card>
        <SectionTitle>ตำแหน่ง</SectionTitle>
        <PickMap
          markers={[{ id: ticket.id, ...ticket.location, color: kind.color, title: ticket.title, subtitle: ticket.location.name }]}
          height={200}
          accessibilityLabel={`แผนที่ตำแหน่งของเรื่อง ${ticket.location.name}`}
        />
        <NavigateButtons place={ticket.location} />
      </Card>

      <Card>
        <SectionTitle>ความคืบหน้า</SectionTitle>
        {[...ticket.events].reverse().map((event, index) => (
          <View key={`${event.at}-${index}`} style={styles.event} accessible>
            <Ionicons name={index === 0 ? 'radio-button-on' : 'ellipse-outline'} size={16} color={index === 0 ? Colors.primary : Colors.textMuted} />
            <View style={{ flex: 1 }}>
              <Text style={styles.eventTitle}>
                {eventLabel(event.type)} · {nameOf(event.byId)}
              </Text>
              {event.note ? <Text style={styles.muted}>{event.note}</Text> : null}
              <Text style={styles.muted}>
                {formatDate(event.at)} {formatTime(event.at)}
              </Text>
            </View>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  badges: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  title: { fontSize: 22, fontWeight: '800', color: Colors.text },
  detail: { fontSize: 15, color: Colors.text, lineHeight: 22 },
  muted: { fontSize: 13, color: Colors.textMuted, lineHeight: 18 },
  photos: { flexDirection: 'row', gap: Spacing.md, flexWrap: 'wrap' },
  photoCell: { flex: 1, minWidth: 140, gap: 4 },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: Radius.md, backgroundColor: Colors.border },
  event: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  eventTitle: { fontSize: 14, fontWeight: '600', color: Colors.text },
});
