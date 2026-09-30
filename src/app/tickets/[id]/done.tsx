// ผู้รับเรื่องแจ้งว่าเสร็จแล้ว: แนบรูปหลังซ่อมได้ (ไม่บังคับ) ผู้แจ้งเทียบก่อน/หลังแล้วกดยืนยัน
// อยู่ไกลจากจุดที่แจ้งเกิน 200 ม. → เตือนให้ตรวจ แต่ไม่บล็อก (ช่างอาจกดตอนกลับถึงห้องช่างแล้ว)

import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text } from 'react-native';

import { CheckInCamera } from '@/components/check-in-camera';
import { PhotoField, type PreparedPhoto } from '@/components/photo-field';
import { Banner, Button, Card, Screen, SectionTitle, StateView, TextField } from '@/components/ui';
import { Colors } from '@/constants/theme';
import { formatDistance } from '@/lib/format';
import { distanceMeters } from '@/lib/geo';
import { getCoordinatesIfPermitted } from '@/services/location';
import { preparePhotoForUpload } from '@/services/photo';
import { useAuthenticatedSession } from '@/state/session-context';
import { useTickets } from '@/state/tickets-context';

const FAR_M = 200;

export default function TicketDoneScreen() {
  const { id: rawId } = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const session = useAuthenticatedSession();
  const { getById, act } = useTickets();
  const ticket = id ? getById(id) : undefined;
  const [photo, setPhoto] = useState<PreparedPhoto | null>(null);
  const [note, setNote] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [distance, setDistance] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ตรวจระยะแบบไม่ขอสิทธิ์ใหม่ (เคยอนุญาตแล้วเท่านั้น) ใช้เตือน ไม่ใช้บล็อก
  useEffect(() => {
    if (!ticket) return;
    getCoordinatesIfPermitted()
      .then((coords) => coords && setDistance(distanceMeters(coords, ticket.location)))
      .catch(() => undefined);
  }, [ticket?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // กำลังส่ง/เพิ่งส่งสำเร็จ (สถานะเปลี่ยนเป็น done ก่อน router.back) → ไม่สลับไปหน้า "ทำรายการนี้ไม่ได้"
  if (!ticket || (!submitting && (ticket.assigneeId !== session?.user.id || ticket.status !== 'accepted'))) {
    return (
      <StateView
        kind="empty"
        icon="lock-closed-outline"
        title="ทำรายการนี้ไม่ได้"
        message="เฉพาะผู้ที่รับเรื่อง และเรื่องต้องอยู่ระหว่างดำเนินการ"
        actionLabel="กลับ"
        onAction={() => router.back()}
      />
    );
  }
  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await act(ticket.id, { type: 'done', photoBase64: photo?.base64, note: note.trim() || undefined });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ส่งไม่สำเร็จ');
      setSubmitting(false);
    }
  };

  if (cameraOpen) {
    return (
      <CheckInCamera
        initialFacing="back"
        purpose="ถ่ายรูปหลังซ่อม"
        reason="ผู้แจ้งจะเห็นรูปนี้เทียบกับรูปตอนแจ้ง ก่อนกดยืนยันว่าเรียบร้อย"
        hint="ถ่ายมุมเดียวกับรูปตอนแจ้ง ให้เห็นว่าแก้แล้ว"
        onClose={() => setCameraOpen(false)}
        onCapture={async (uri) => {
          setCameraOpen(false);
          try {
            setPhoto(await preparePhotoForUpload(uri));
          } catch (e) {
            setError(e instanceof Error ? e.message : 'ประมวลผลรูปไม่สำเร็จ');
          }
        }}
      />
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <Card>
          <SectionTitle>{ticket.title}</SectionTitle>
          <Text style={styles.muted}>{ticket.location.name}</Text>
          {distance !== null && distance > FAR_M ? (
            <Banner tone="warning" icon="navigate">
              ตอนนี้คุณอยู่ห่างจุดที่แจ้ง {formatDistance(distance)} ตรวจให้แน่ใจว่าถ่ายรูปที่จุดนั้นแล้ว
            </Banner>
          ) : null}
        </Card>
        <Card>
          <SectionTitle>รูปหลังซ่อม (ไม่บังคับ)</SectionTitle>
          <PhotoField
            photo={photo}
            onChange={setPhoto}
            onOpenCamera={() => setCameraOpen(true)}
            emptyText="ถ่ายให้เห็นว่าแก้แล้ว ผู้แจ้งจะเทียบกับรูปตอนแจ้ง"
          />
          <TextField
            label="บันทึกสั้น ๆ"
            value={note}
            onChangeText={setNote}
            maxLength={300}
            placeholder="เช่น เปลี่ยนหลอดไฟ 3 ดวง"
          />
        </Card>
        {error ? <Banner tone="danger">{error}</Banner> : null}
        <Button title={submitting ? 'กำลังส่ง…' : 'แจ้งว่าเสร็จแล้ว'} icon="checkmark-done" loading={submitting} onPress={submit} />
        <Text style={styles.muted}>ผู้แจ้งจะได้แจ้งเตือนให้กดยืนยัน ถ้ายังไม่เรียบร้อยเรื่องจะกลับมาที่คุณ</Text>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  muted: { fontSize: 13, color: Colors.textMuted, lineHeight: 18 },
});
