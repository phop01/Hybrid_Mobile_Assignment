// ผู้จัดสร้างกิจกรรม (สัปดาห์ 5 ฟอร์ม + 6 POST + 8 สิทธิ์ผู้จัด + 10 ปักหมุดสถานที่)

import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PickMap } from '@/components/pick-map';
import { Banner, Button, Card, Chip, Screen, SectionTitle, TextField } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import {
  activityHours,
  atTime,
  buildActivityInput,
  emptyActivityForm,
  type ActivityFormErrors,
  type ActivityFormValues,
} from '@/lib/activity-form';
import { useNow } from '@/hooks/use-now';
import { CATEGORIES, CATEGORY_ORDER } from '@/lib/categories';
import { formatDate } from '@/lib/format';
import { ApiError } from '@/services/api-client';
import * as api from '@/services/campus-api';
import { getCurrentCoordinates } from '@/services/location';
import { pickCoverImage, preparePhotoForUpload } from '@/services/photo';
import { useActivities } from '@/state/activities-context';
import { useOrganizerSession } from '@/state/session-context';

const DAYS = [0, 1, 2, 3, 4, 5, 6];
const RADII = [50, 100, 150, 300];

export default function NewActivityScreen() {
  const session = useOrganizerSession();
  const { upsert } = useActivities();
  const [values, setValues] = useState<ActivityFormValues>(emptyActivityForm);
  const [errors, setErrors] = useState<ActivityFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [cover, setCover] = useState<{ uri: string; base64: string } | null>(null);
  const [coverBusy, setCoverBusy] = useState(false);
  // นิ้วอยู่บนแผนที่ → ปิดการเลื่อนหน้า ไม่งั้น iPhone เลื่อนหน้าแทนการลากหมุด
  const [mapTouching, setMapTouching] = useState(false);

  // รูปปกจากคลัง: ย่อก่อนส่งเหมือนรูปเช็กอิน (ไม่เกินกว้าง 960px) ส่งเร็วและไม่เปลืองพื้นที่ server
  const chooseCover = async () => {
    setCoverBusy(true);
    try {
      const uri = await pickCoverImage();
      if (uri) setCover(await preparePhotoForUpload(uri));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'ใช้รูปนี้ไม่ได้ ลองเลือกรูปอื่น');
    } finally {
      setCoverBusy(false);
    }
  };

  const set = <K extends keyof ActivityFormValues>(field: K, value: ActivityFormValues[K]) => {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined, ...(field === 'latitude' ? { location: undefined } : {}) }));
  };

  // ชั่วโมงที่นักศึกษาจะได้ แสดงทันทีที่กรอกเวลาถูก (ไม่ต้องรอกรอกครบทั้งฟอร์ม)
  const now = useNow(60000);
  const start = atTime(now, values.dayOffset, values.startTime);
  const end = atTime(now, values.dayOffset, values.endTime);
  const previewHours = start && end && end > start ? activityHours(start, end) : null;
  const picked = values.latitude !== null && values.longitude !== null ? { latitude: values.latitude, longitude: values.longitude } : null;

  const fillMyLocation = async () => {
    setLocating(true);
    const result = await getCurrentCoordinates();
    setLocating(false);
    if (result.status === 'ok') {
      setValues((v) => ({ ...v, latitude: result.coords.latitude, longitude: result.coords.longitude }));
      setErrors((e) => ({ ...e, location: undefined }));
    } else {
      setMessage(result.status === 'denied' ? 'ไม่ได้รับสิทธิ์ตำแหน่ง ปักหมุดบนแผนที่เองได้' : result.message);
    }
  };

  const submit = async () => {
    if (submitting || !session) return;
    const built = buildActivityInput(values);
    if (!built.ok) {
      setErrors(built.errors);
      setMessage('กรุณาตรวจข้อมูลที่ขึ้นสีแดง');
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      const activity = await api.createActivity(session.token, { ...built.input, coverBase64: cover?.base64 });
      upsert(activity); // นักศึกษาในเครื่องนี้เห็นกิจกรรมใหม่ทันที เครื่องอื่นเห็นเมื่อรีเฟรช
      router.replace({ pathname: '/organizer/[id]', params: { id: activity.id } });
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fields).length > 0) setErrors(e.fields as ActivityFormErrors);
      setMessage(e instanceof Error ? e.message : 'สร้างกิจกรรมไม่สำเร็จ');
      setSubmitting(false);
    }
  };

  const dayLabel = (d: number) => {
    if (d === 0) return 'วันนี้';
    if (d === 1) return 'พรุ่งนี้';
    const date = new Date();
    date.setDate(date.getDate() + d);
    return formatDate(date.toISOString());
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen scrollEnabled={!mapTouching}>
        <Card>
          <SectionTitle>ข้อมูลกิจกรรม</SectionTitle>
          <TextField label="ชื่อกิจกรรม *" value={values.title} onChangeText={(t) => set('title', t)} error={errors.title} maxLength={100} />
          <TextField
            label="รายละเอียด *"
            value={values.description}
            onChangeText={(t) => set('description', t)}
            error={errors.description}
            multiline
            style={styles.multiline}
            maxLength={1000}
            placeholder="ทำอะไร เตรียมอะไรมา แต่งกายอย่างไร"
          />
          <Text style={styles.label}>ประเภท</Text>
          <View style={styles.row}>
            {CATEGORY_ORDER.map((c) => (
              <Chip key={c} label={CATEGORIES[c].label} color={CATEGORIES[c].color} selected={values.category === c} onPress={() => set('category', c)} />
            ))}
          </View>
        </Card>

        <Card>
          <SectionTitle>รูปปกกิจกรรม (ไม่บังคับ)</SectionTitle>
          <Text style={styles.muted}>เลือกโปสเตอร์หรือรูปบรรยากาศจากคลังรูป นักศึกษาจะเห็นบนการ์ดและหน้ารายละเอียด</Text>
          {cover ? (
            <Image source={{ uri: cover.uri }} style={styles.cover} contentFit="cover" accessibilityLabel="รูปปกที่เลือก" />
          ) : null}
          <View style={styles.row}>
            <View style={styles.flex}>
              <Button
                title={cover ? 'เปลี่ยนรูป' : 'เลือกจากคลังรูป'}
                icon="images-outline"
                variant="secondary"
                loading={coverBusy}
                onPress={chooseCover}
              />
            </View>
            {cover ? (
              <View style={styles.flex}>
                <Button title="ลบรูป" icon="trash-outline" variant="ghost" onPress={() => setCover(null)} />
              </View>
            ) : null}
          </View>
        </Card>

        <Card>
          <SectionTitle>วันและเวลา</SectionTitle>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollRow}>
            {DAYS.map((d) => (
              <Chip key={d} label={dayLabel(d)} selected={values.dayOffset === d} onPress={() => set('dayOffset', d)} />
            ))}
          </ScrollView>
          <View style={styles.row}>
            <View style={styles.flex}>
              <TextField label="เริ่ม (HH:MM)" value={values.startTime} onChangeText={(t) => set('startTime', t)} error={errors.startTime} maxLength={5} />
            </View>
            <View style={styles.flex}>
              <TextField label="จบ (HH:MM)" value={values.endTime} onChangeText={(t) => set('endTime', t)} error={errors.endTime} maxLength={5} />
            </View>
          </View>
          {previewHours !== null ? (
            <Banner tone="info" icon="time-outline">
              นักศึกษาที่เข้าร่วมจะได้ {previewHours} ชั่วโมงกิจกรรม เมื่อคุณตรวจหลักฐานผ่าน
            </Banner>
          ) : null}
        </Card>

        <Card>
          <SectionTitle>สถานที่จัดงาน</SectionTitle>
          <TextField
            label="ชื่อสถานที่ *"
            value={values.locationName}
            onChangeText={(t) => set('locationName', t)}
            error={errors.locationName}
            placeholder="เช่น ห้องประชุม คณะสหวิทยาการ"
          />
          <Button title={locating ? 'กำลังหาตำแหน่ง…' : 'ใช้ตำแหน่งปัจจุบัน'} icon="locate" variant="secondary" loading={locating} onPress={fillMyLocation} />
          <PickMap
            markers={[]}
            picked={picked}
            onPick={(c) => {
              setValues((v) => ({ ...v, latitude: c.latitude, longitude: c.longitude }));
              setErrors((e) => ({ ...e, location: undefined }));
            }}
            height={240}
            onInteractingChange={setMapTouching}
            accessibilityLabel="แผนที่สำหรับปักหมุดสถานที่จัดกิจกรรม"
          />
          {errors.location ? (
            <Text style={styles.error} accessibilityRole="alert">
              {errors.location}
            </Text>
          ) : (
            <Text style={styles.muted}>แตะแผนที่หรือลากหมุดไปที่สถานที่จัดงาน</Text>
          )}
          <Text style={styles.label}>บริเวณจัดงาน (รัศมีบนแผนที่)</Text>
          <View style={styles.row}>
            {RADII.map((r) => (
              <Chip key={r} label={`${r} ม.`} selected={values.radiusM === r} onPress={() => set('radiusM', r)} />
            ))}
          </View>
        </Card>

        <Card>
          <SectionTitle>หลักฐานการเข้าร่วมและจำนวนรับ</SectionTitle>
          <View style={styles.row}>
            <Chip label="ถ่ายรูปที่งาน" selected={values.checkInMethod === 'app'} onPress={() => set('checkInMethod', 'app')} />
            <Chip label="ใบเซ็นชื่อกระดาษ" selected={values.checkInMethod === 'paper'} onPress={() => set('checkInMethod', 'paper')} />
          </View>
          <Text style={styles.muted}>
            {values.checkInMethod === 'app'
              ? 'นักศึกษาถ่ายรูปที่งานส่งมา คุณตรวจในแอปก่อนนับชั่วโมง'
              : 'นักศึกษาถ่ายรูปใบเซ็นชื่อส่งมา คุณตรวจในแอปก่อนนับชั่วโมง'}
          </Text>
          <TextField
            label="จำนวนรับ (คน) *"
            value={values.capacity}
            onChangeText={(t) => set('capacity', t.replace(/\D/g, '').slice(0, 4))}
            error={errors.capacity}
            keyboardType="number-pad"
          />
        </Card>

        {message ? <Banner tone="danger">{message}</Banner> : null}
        <Button title={submitting ? 'กำลังสร้าง…' : 'สร้างกิจกรรม'} icon="checkmark-circle" onPress={submit} loading={submitting} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  scrollRow: { flexDirection: 'row', gap: Spacing.sm, paddingVertical: 2 },
  flex: { flex: 1, minWidth: 130 },
  label: { fontSize: 14, fontWeight: '600', color: Colors.text },
  muted: { fontSize: 13, color: Colors.textMuted, lineHeight: 18 },
  error: { fontSize: 13, color: Colors.danger },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  cover: { width: '100%', aspectRatio: 16 / 9, borderRadius: Radius.md, backgroundColor: Colors.border },
});
