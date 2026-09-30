// เจ้าหน้าที่ส่งประกาศถึงทุกคนในวิทยาเขต เช่น ปิดน้ำ ปิดถนน ย้ายห้องกิจกรรม
// ทุกคนได้แจ้งเตือน และประกาศแสดงบนหน้า "วันนี้" จนหมดเวลาที่ตั้งไว้

import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';

import { BroadcastCard } from '@/components/broadcast-card';
import type { PreparedPhoto } from '@/components/photo-field';
import { PickMap } from '@/components/pick-map';
import { Banner, Button, Card, Chip, Screen, SectionTitle, TextField } from '@/components/ui';
import { Colors, DEFAULT_CENTER, Radius, Spacing } from '@/constants/theme';
import type { Coordinates } from '@/lib/geo';
import { ApiError } from '@/services/api-client';
import { pickPosterImage, preparePhotoForUpload } from '@/services/photo';
import { useAuthenticatedSession } from '@/state/session-context';
import { useTickets } from '@/state/tickets-context';

const HOURS = [1, 3, 6, 12, 24];

export default function NewBroadcastScreen() {
  const { broadcast, broadcasts, endBroadcast } = useTickets();
  const myId = useAuthenticatedSession()?.user.id;
  // ยกเลิกได้เฉพาะประกาศของตัวเอง (server ตรวจซ้ำ)
  const mine = broadcasts.filter((b) => b.byId === myId);
  const [message, setMessage] = useState('');
  const [placeName, setPlaceName] = useState('');
  const [point, setPoint] = useState<Coordinates>(DEFAULT_CENTER);
  const [hours, setHours] = useState(3);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [mapTouching, setMapTouching] = useState(false);
  const [poster, setPoster] = useState<PreparedPhoto | null>(null);
  const [posterBusy, setPosterBusy] = useState(false);
  const [posterError, setPosterError] = useState<string | null>(null);

  // โปสเตอร์ไม่บังคับ: เลือกจากคลัง (ส่วนใหญ่มีไฟล์โปสเตอร์อยู่แล้ว) ย่อกว้าง 960px ก่อนส่ง
  const choosePoster = async () => {
    setPosterBusy(true);
    setPosterError(null);
    try {
      const uri = await pickPosterImage();
      if (uri) setPoster(await preparePhotoForUpload(uri));
    } catch (e) {
      setPosterError(e instanceof Error ? e.message : 'ใช้รูปนี้ไม่ได้ ลองเลือกรูปอื่น');
    } finally {
      setPosterBusy(false);
    }
  };

  const send = async () => {
    // ประกาศซ้ำ = ทุกคนได้แจ้งเตือนสองรอบ จึงกันกดรัว
    if (sending) return;
    const nextErrors: Record<string, string> = {};
    if (message.trim().length < 5) nextErrors.message = 'ข้อความต้องยาวอย่างน้อย 5 ตัวอักษร';
    if (placeName.trim().length < 2) nextErrors.locationName = 'กรุณาระบุสถานที่';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setSending(true);
    setError(null);
    try {
      await broadcast({
        message: message.trim(),
        location: { name: placeName.trim(), ...point },
        hours,
        ...(poster ? { posterBase64: poster.base64 } : {}),
      });
      router.back();
    } catch (e) {
      if (e instanceof ApiError) setErrors(e.fields);
      setError(e instanceof Error ? e.message : 'ส่งประกาศไม่สำเร็จ');
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen scrollEnabled={!mapTouching}>
        <Banner tone="info" icon="megaphone">
          ทุกคนในแอปจะได้แจ้งเตือนทันที ใช้กับเรื่องที่กระทบหลายคน เช่น ปิดน้ำ ปิดถนน ย้ายห้อง
        </Banner>
        <Card>
          <SectionTitle>ข้อความ</SectionTitle>
          <TextField
            label="ประกาศ *"
            value={message}
            onChangeText={setMessage}
            error={errors.message}
            multiline
            style={styles.multiline}
            maxLength={200}
            placeholder="เช่น ปิดน้ำประปาอาคารเรียนรวม 13:00–16:00 น."
          />
          <Text style={styles.label}>แสดงบนหน้าแรกนาน</Text>
          <View style={styles.row}>
            {HOURS.map((h) => (
              <Chip key={h} label={`${h} ชม.`} selected={hours === h} onPress={() => setHours(h)} />
            ))}
          </View>
        </Card>
        <Card>
          <SectionTitle>โปสเตอร์ (ไม่บังคับ)</SectionTitle>
          <Text style={styles.muted}>แนบโปสเตอร์กิจกรรม/ประกาศได้ จะแสดงเป็นการ์ดรูปบนหน้า “วันนี้” ของทุกคน แตะแล้วดูเต็มจอ</Text>
          {poster ? (
            <Image source={{ uri: poster.uri }} style={styles.poster} contentFit="contain" accessibilityLabel="โปสเตอร์ที่เลือก" />
          ) : null}
          <View style={styles.row}>
            <View style={styles.flex}>
              <Button
                title={poster ? 'เปลี่ยนโปสเตอร์' : 'เลือกรูปโปสเตอร์'}
                icon="image-outline"
                variant="secondary"
                loading={posterBusy}
                onPress={choosePoster}
              />
            </View>
            {poster ? (
              <View style={styles.flex}>
                <Button title="ไม่ใส่โปสเตอร์" icon="trash-outline" variant="ghost" onPress={() => setPoster(null)} />
              </View>
            ) : null}
          </View>
          {posterError ? (
            <Text style={styles.error} accessibilityRole="alert">
              {posterError}
            </Text>
          ) : null}
        </Card>
        <Card>
          <SectionTitle>สถานที่</SectionTitle>
          <TextField label="ชื่อสถานที่ *" value={placeName} onChangeText={setPlaceName} error={errors.locationName} placeholder="เช่น อาคารเรียนรวม" />
          <PickMap
            markers={[]}
            picked={point}
            onPick={setPoint}
            height={200}
            onInteractingChange={setMapTouching}
            accessibilityLabel="แผนที่สำหรับปักหมุดสถานที่ของประกาศ"
          />
        </Card>
        {error ? <Banner tone="danger">{error}</Banner> : null}
        <Button title={sending ? 'กำลังส่ง…' : 'ส่งประกาศ'} icon="send" loading={sending} onPress={send} />

        {mine.length > 0 ? (
          <Card>
            <SectionTitle>ประกาศของฉันที่ใช้อยู่</SectionTitle>
            {mine.map((b) => (
              <View key={b.id} style={styles.item}>
                <BroadcastCard broadcast={b} compact />
                <Button title="ยกเลิกประกาศนี้" variant="ghost" icon="close-circle-outline" onPress={() => endBroadcast(b.id).catch((e) => setError(e.message))} />
              </View>
            ))}
          </Card>
        ) : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  label: { fontSize: 14, fontWeight: '600', color: Colors.text },
  muted: { fontSize: 13, color: Colors.textMuted },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  item: { gap: 4 },
  flex: { flex: 1, minWidth: 150 },
  error: { fontSize: 13, color: Colors.danger },
  // แสดงทั้งใบ (โปสเตอร์มีหลายสัดส่วน) แต่ไม่สูงเกินจอ
  poster: { width: '100%', height: 320, borderRadius: Radius.md, backgroundColor: '#1F2230' },
});
