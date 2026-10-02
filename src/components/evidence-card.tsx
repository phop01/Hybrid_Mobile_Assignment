import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Linking, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { ActivityMap } from '@/components/activity-map';
import { CheckInCamera } from '@/components/check-in-camera';
import { Banner, Button, Card, SectionTitle, StateView } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { canCheckIn } from '@/lib/check-in-rules';
import { formatDate, formatTime, formatVenueDistance } from '@/lib/format';
import { distanceMeters, type Coordinates } from '@/lib/geo';
import { confirmAction } from '@/lib/platform-actions';
import { PHOTO_SOURCE_LABEL } from '@/lib/photo-time';
import { toAbsoluteUrl } from '@/services/api-config';
import { getCurrentCoordinates } from '@/services/location';
import { pickPhotoFromLibrary, preparePhotoForUpload } from '@/services/photo';
import { useMyRegistrations } from '@/state/my-registrations-context';
import type { Activity, PhotoSource, Registration } from '@/types/models';
import { Text } from '@/components/app-text';

type LocationState =
  | { status: 'locating' }
  | { status: 'ok'; coords: Coordinates }
  | { status: 'denied'; canAskAgain: boolean }
  | { status: 'error'; message: string };

type Photo = { uri: string; base64: string; takenAt: string; source: PhotoSource };

/** แนบรูปเพิ่มได้ไม่เกินเท่านี้ (ตรงกับ server) */
const MAX_EXTRA_PHOTOS = 5;

/**
 * หลักฐานการเข้าร่วม (อยู่ในหน้าการลงทะเบียน ไม่ต้องไปอีกหน้า): ตำแหน่ง + ถ่ายรูป + ส่ง
 * ไม่บังคับตำแหน่ง/เวลา (ผู้ใช้ตัดสินใจ แชทที่ 3) ตำแหน่งที่ได้ถูกบันทึกให้เจ้าหน้าที่ดูประกอบการตรวจ
 * ส่งแล้วแนบรูปเพิ่มได้ (เช่น ถ่ายบรรยากาศงานเพิ่ม)
 */
export function EvidenceCard({ registration, activity }: { registration: Registration; activity: Activity }) {
  const { checkIn, addPhoto, removePhoto, queuedIds } = useMyRegistrations();
  const [location, setLocation] = useState<LocationState>({ status: 'locating' });
  // main = รูปหลักก่อนส่ง · extra = รูปที่แนบเพิ่มหลังส่ง
  const [camera, setCamera] = useState<'main' | 'extra' | null>(null);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const isPaper = activity.checkInMethod === 'paper';
  const queued = queuedIds.includes(registration.id);
  const decision = canCheckIn(registration);
  const canSubmit = decision.ok && !queued;

  // หาตำแหน่งเฉพาะตอนยังส่งหลักฐานได้ (ไม่ขอสิทธิ์ตำแหน่งถ้าส่งไปแล้ว)
  useEffect(() => {
    if (!canSubmit) return;
    let cancelled = false;
    getCurrentCoordinates().then((result) => {
      if (!cancelled) setLocation(result.status === 'ok' ? { status: 'ok', coords: result.coords } : result);
    });
    return () => {
      cancelled = true;
    };
  }, [canSubmit]);

  const locate = async () => {
    setLocation({ status: 'locating' });
    const result = await getCurrentCoordinates();
    setLocation(result.status === 'ok' ? { status: 'ok', coords: result.coords } : result);
  };

  const coords = location.status === 'ok' ? location.coords : null;
  const distance = coords ? distanceMeters(coords, activity.location) : null;

  const prepare = async (uri: string, takenAt: string, source: PhotoSource, target: 'main' | 'extra') => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const prepared = await preparePhotoForUpload(uri);
      if (target === 'main') {
        setPhoto({ ...prepared, takenAt, source });
      } else {
        await addPhoto(registration.id, prepared.base64);
        setMessage('แนบรูปเพิ่มแล้ว');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ใช้รูปนี้ไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const onCaptured = (uri: string) => {
    const target = camera ?? 'main';
    setCamera(null);
    prepare(uri, new Date().toISOString(), 'camera', target);
  };

  const pickFromLibrary = async (target: 'main' | 'extra') => {
    setError(null);
    const picked = await pickPhotoFromLibrary();
    if (!picked) return;
    // ไม่ตรวจเวลาถ่าย: รูปที่ไม่มีเวลาในรูป (เช่น บนเว็บ) ใช้เวลาที่เลือกแทน
    prepare(picked.uri, picked.takenAt ?? new Date().toISOString(), 'library', target);
  };

  const submit = async () => {
    if (!photo || busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const outcome = await checkIn({
        registrationId: registration.id,
        photoBase64: photo.base64,
        photoSource: photo.source,
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
        takenAt: photo.takenAt,
        createdAt: new Date().toISOString(),
      });
      setPhoto(null);
      setMessage(
        outcome.kind === 'queued'
          ? 'ตอนนี้ออฟไลน์ แอปเก็บรูปไว้ในเครื่องแล้ว จะส่งให้อัตโนมัติเมื่อกลับมามีอินเทอร์เน็ต'
          : outcome.registration.status === 'pending_review'
            ? 'ส่งหลักฐานแล้ว รอเจ้าหน้าที่ตรวจ'
            : 'เช็กอินสำเร็จ นับในโปรไฟล์ของคุณแล้ว',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ส่งไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  // ลบรูปที่แนบเพิ่ม (ถ่ายผิด) รูปแรกคือหลักฐานหลักที่ส่งไปแล้ว ลบไม่ได้
  const deleteExtra = async (url: string, index: number) => {
    const ok = await confirmAction('ลบรูปนี้?', `ลบรูปที่แนบเพิ่มรูปที่ ${index + 1}`, 'ลบรูป');
    if (!ok) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await removePhoto(registration.id, url);
      setMessage('ลบรูปแล้ว');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ลบรูปไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const record = registration.checkIn;
  const photos = record ? [record.photoUrl, ...(record.extraPhotos ?? [])] : [];
  const extraCount = record?.extraPhotos?.length ?? 0;
  const submitted = registration.status === 'pending_review' || registration.status === 'checked_in';

  return (
    <Card>
      <SectionTitle>หลักฐานการเข้าร่วม</SectionTitle>
      {canSubmit ? (
        <Text style={styles.muted}>
          {isPaper
            ? 'เซ็นชื่อกับเจ้าหน้าที่ แล้วถ่ายรูปใบเซ็นชื่อ (หรือบรรยากาศงาน) ส่งเป็นหลักฐาน เจ้าหน้าที่จะตรวจแล้วนับชั่วโมง'
            : 'ถ่ายรูปตัวเองที่งานส่งเป็นหลักฐาน เจ้าหน้าที่จะตรวจแล้วนับชั่วโมง'}
        </Text>
      ) : null}

      {registration.reviewNote && registration.status === 'registered' ? (
        <Banner tone="danger" icon="close-circle">
          หลักฐานครั้งก่อนไม่ผ่าน: {registration.reviewNote} — ส่งใหม่ได้เลย
        </Banner>
      ) : null}
      {queued && registration.status === 'registered' ? (
        <Banner tone="warning" icon="cloud-upload">
          ถ่ายรูปแล้ว แต่ยังส่งไม่ได้เพราะออฟไลน์ แอปจะส่งให้อัตโนมัติเมื่อกลับมามีอินเทอร์เน็ต
        </Banner>
      ) : null}
      {registration.status === 'pending_review' ? (
        <Banner tone="warning" icon="hourglass">
          ส่งหลักฐานแล้ว เจ้าหน้าที่กำลังตรวจ จะนับเป็นกิจกรรมที่เข้าร่วมเมื่อตรวจผ่าน
        </Banner>
      ) : null}
      {registration.status === 'checked_in' ? <Banner tone="success">เข้าร่วมแล้ว นับในโปรไฟล์ของคุณแล้ว</Banner> : null}
      {registration.status === 'cancelled' ? (
        <Banner tone="info">{registration.reviewNote ?? 'การลงทะเบียนนี้ถูกยกเลิกแล้ว'}</Banner>
      ) : null}
      {registration.status === 'rejected' ? (
        <Banner tone="danger" icon="ban">
          เจ้าหน้าที่ไม่รับการลงทะเบียนนี้: {registration.reviewNote}
        </Banner>
      ) : null}

      {canSubmit ? (
        <>
          <ActivityMap venue={activity.location} title={activity.title} user={coords} height={180} />
          {location.status === 'locating' ? <Text style={styles.muted}>กำลังหาตำแหน่งของคุณ…</Text> : null}
          {distance !== null ? <Text style={styles.info}>{formatVenueDistance(distance)} (บันทึกไว้ให้เจ้าหน้าที่ดู)</Text> : null}
          {location.status === 'denied' || location.status === 'error' ? (
            <>
              <Text style={styles.muted}>ไม่ได้ตำแหน่ง ส่งหลักฐานได้โดยไม่มีตำแหน่ง</Text>
              {location.status === 'denied' && !location.canAskAgain && Platform.OS !== 'web' ? (
                <Button title="เปิดการตั้งค่าเพื่ออนุญาตตำแหน่ง" icon="settings-outline" variant="ghost" onPress={() => Linking.openSettings()} />
              ) : (
                <Button title="ลองหาตำแหน่งอีกครั้ง" icon="refresh" variant="ghost" onPress={locate} />
              )}
            </>
          ) : null}

          {photo ? (
            <>
              <Image source={{ uri: photo.uri }} style={styles.preview} contentFit="cover" accessibilityLabel="รูปที่จะส่ง" />
              <Text style={styles.muted}>
                {PHOTO_SOURCE_LABEL[photo.source]} · {formatTime(photo.takenAt)}
              </Text>
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Button title="ถ่ายใหม่" icon="camera-reverse-outline" variant="secondary" disabled={busy} onPress={() => setCamera('main')} />
                </View>
                <View style={styles.flex}>
                  <Button title="เลือกจากคลัง" icon="images-outline" variant="secondary" disabled={busy} onPress={() => pickFromLibrary('main')} />
                </View>
              </View>
              <Button title="ลบรูป" icon="trash-outline" variant="ghost" disabled={busy} onPress={() => setPhoto(null)} />
              <Button title="ส่งหลักฐาน" icon="send" loading={busy} onPress={submit} />
            </>
          ) : busy ? (
            <StateView kind="loading" message="กำลังเตรียมรูป…" />
          ) : (
            <View style={styles.row}>
              <View style={styles.flex}>
                <Button title="ถ่ายรูป" icon="camera" onPress={() => setCamera('main')} />
              </View>
              <View style={styles.flex}>
                <Button title="เลือกจากคลัง" icon="images-outline" variant="secondary" onPress={() => pickFromLibrary('main')} />
              </View>
            </View>
          )}
        </>
      ) : null}

      {record ? (
        <View style={{ gap: Spacing.sm }}>
          <View style={styles.grid}>
            {photos.map((url, i) => (
              <View key={url} style={[styles.thumb, i === 0 && photos.length === 1 && styles.single]}>
                <Image
                  source={{ uri: toAbsoluteUrl(url) }}
                  style={styles.thumbImage}
                  contentFit="cover"
                  accessibilityLabel={`รูปหลักฐานที่ ${i + 1}`}
                />
                {i > 0 && submitted && !busy ? (
                  <Pressable
                    onPress={() => deleteExtra(url, i)}
                    style={styles.remove}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`ลบรูปที่ ${i + 1}`}>
                    <Ionicons name="close" size={18} color="#fff" />
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>
          <Text style={styles.muted}>
            {record.photoSource && record.photoSource !== 'camera' ? `${PHOTO_SOURCE_LABEL[record.photoSource]} · ` : ''}ส่งเมื่อ{' '}
            {formatDate(record.submittedAt)} {formatTime(record.submittedAt)} · {formatVenueDistance(record.distanceM)}
          </Text>
          {submitted && extraCount < MAX_EXTRA_PHOTOS ? (
            busy ? (
              <StateView kind="loading" message="กำลังแนบรูป…" />
            ) : (
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Button title="ถ่ายรูปเพิ่ม" icon="camera-outline" variant="secondary" onPress={() => setCamera('extra')} />
                </View>
                <View style={styles.flex}>
                  <Button title="เพิ่มจากคลัง" icon="images-outline" variant="ghost" onPress={() => pickFromLibrary('extra')} />
                </View>
              </View>
            )
          ) : null}
        </View>
      ) : null}

      {message ? <Banner tone="success">{message}</Banner> : null}
      {error ? <Banner tone="danger">{error}</Banner> : null}

      <Modal visible={camera !== null} animationType="slide" onRequestClose={() => setCamera(null)}>
        {camera !== null ? (
          <CheckInCamera
            initialFacing={isPaper ? 'back' : 'front'}
            hint={isPaper ? 'ถ่ายให้เห็นชื่อและลายเซ็นของคุณในใบเซ็นชื่อชัด ๆ' : 'ถ่ายตัวคุณให้เห็นบรรยากาศงานด้านหลัง'}
            onCapture={onCaptured}
            onClose={() => setCamera(null)}
          />
        ) : null}
      </Modal>
    </Card>
  );
}

const styles = StyleSheet.create({
  muted: { fontSize: 13, color: Colors.textMuted, lineHeight: 19 },
  info: { fontSize: 14, color: Colors.text, fontWeight: '600' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  flex: { flex: 1, minWidth: 140 },
  preview: { width: '100%', aspectRatio: 3 / 4, maxHeight: 420, borderRadius: Radius.md, backgroundColor: Colors.border },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  thumb: { width: '31%', aspectRatio: 1, borderRadius: Radius.md, backgroundColor: Colors.border, overflow: 'hidden' },
  thumbImage: { width: '100%', height: '100%' },
  remove: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  single: { width: '100%', aspectRatio: 4 / 3 },
});
