// แจ้งซ่อม: ฟอร์ม 3 ขั้น (สัปดาห์ 5 ฟอร์ม + 9 กล้อง + 10 ตำแหน่ง + 7 คิวออฟไลน์)
// ขั้น 2 เช็กว่ามีคนแจ้งเรื่องเดียวกันในรัศมี 50 ม. แล้วหรือยัง → กด "เจอเหมือนกัน" แทนการแจ้งซ้ำ

import { router } from 'expo-router';
import { useMemo, useReducer, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CheckInCamera } from '@/components/check-in-camera';
import { PhotoField } from '@/components/photo-field';
import { PickMap } from '@/components/pick-map';
import { TicketCard } from '@/components/ticket-card';
import { Banner, Button, Card, Chip, Screen, SectionTitle, TextField } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { nearestPlace, parseRoomCode, PICKABLE_PLACES, type CampusPlace } from '@/lib/campus';
import { formatDistance } from '@/lib/format';
import {
  initialTicketForm,
  ticketFormReducer,
  toTicketInput,
  validateStep,
  type TicketFormErrors,
} from '@/lib/ticket-form';
import { categoryInfo, findDuplicates, KIND_INFO, REPAIR_ORDER } from '@/lib/tickets';
import { ApiError } from '@/services/api-client';
import { getCurrentCoordinates } from '@/services/location';
import { preparePhotoForUpload } from '@/services/photo';
import { useAuthenticatedSession } from '@/state/session-context';
import { useTickets } from '@/state/tickets-context';

const STEP_TITLES = ['เรื่องอะไร', 'ที่ไหน', 'รายละเอียด'];

export default function NewTicketScreen() {
  const session = useAuthenticatedSession();
  const isStaff = session?.user.role === 'organizer';
  const [state, dispatch] = useReducer(ticketFormReducer, 'repair', initialTicketForm);
  const [errors, setErrors] = useState<TicketFormErrors>({});
  const [cameraOpen, setCameraOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationNote, setLocationNote] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // server ถือว่ากด "เจอเหมือนกัน" ซ้ำ = เลิกติดตาม จึงต้องกันกดรัว
  const [followingId, setFollowingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [mapTouching, setMapTouching] = useState(false);
  const { tickets, create, act } = useTickets();

  const locate = async () => {
    setLocating(true);
    setLocationNote(null);
    const result = await getCurrentCoordinates();
    setLocating(false);
    if (result.status === 'ok') {
      dispatch({ type: 'setPoint', point: result.coords });
      // อยู่ใกล้อาคารไหน → เติมชื่ออาคารให้ (ถ้ายังไม่ได้พิมพ์เอง) ผู้ใช้เติมชั้น/ห้องต่อได้
      const near = nearestPlace(result.coords);
      if (near && !state.placeName.trim()) dispatch({ type: 'setField', field: 'placeName', value: near.place.name });
      setLocationNote(near ? `อยู่ใกล้ ${near.place.name} (${formatDistance(near.distance)})` : null);
    } else setLocationNote(result.status === 'denied' ? 'ไม่ได้รับสิทธิ์ตำแหน่ง แตะแผนที่เพื่อปักหมุดเองได้' : result.message);
  };

  /** เลือกอาคารจากปุ่มลัด → ย้ายหมุดไปที่อาคาร + ใช้ชื่ออาคารเป็นจุดสังเกต (แก้/เติมชั้นต่อได้) */
  const chooseBuilding = (place: CampusPlace) => {
    dispatch({ type: 'setPoint', point: { latitude: place.latitude, longitude: place.longitude } });
    dispatch({ type: 'setField', field: 'placeName', value: place.name });
    setErrors((e) => ({ ...e, point: undefined, placeName: undefined }));
    setLocationNote(null);
  };

  // พิมพ์รหัสห้องแบบ NK2217 → รู้ว่าเป็นอาคาร/ชั้นไหน
  const roomCode = parseRoomCode(state.placeName);

  const duplicates = useMemo(
    () => (state.point && state.category ? findDuplicates(tickets, state.point, state.category) : []),
    [state.category, state.point, tickets],
  );

  const next = () => {
    const stepErrors = validateStep(state, state.step);
    setErrors(stepErrors);
    if (Object.keys(stepErrors).length > 0) return;
    dispatch({ type: 'next' });
    // เข้าขั้นที่ 2 → หาตำแหน่งให้เลย ผู้ใช้ส่วนใหญ่แจ้งตอนยืนอยู่ตรงจุดนั้น
    if (state.step === 1 && !state.point) locate();
  };

  const follow = async (id: string) => {
    if (followingId) return;
    setFollowingId(id);
    try {
      await act(id, { type: 'follow' });
      router.replace({ pathname: '/tickets/[id]', params: { id } });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'กดติดตามไม่สำเร็จ');
      setFollowingId(null);
    }
  };

  const submit = async () => {
    if (submitting) return;
    const input = toTicketInput(state);
    if (!input) {
      setErrors(validateStep(state, 3));
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      const outcome = await create(input);
      if (outcome.kind === 'sent') router.replace({ pathname: '/tickets/[id]', params: { id: outcome.ticket.id } });
      else router.replace('/tickets');
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fields).length > 0) setErrors(e.fields as TicketFormErrors);
      setMessage(e instanceof Error ? e.message : 'ส่งไม่สำเร็จ');
      setSubmitting(false);
    }
  };

  if (cameraOpen) {
    return (
      <CheckInCamera
        initialFacing="back"
        purpose="ถ่ายรูปปัญหา"
        reason="รูปช่วยให้เจ้าหน้าที่รู้ว่าต้องเตรียมอะไรไปซ่อม และใช้เทียบก่อน/หลังซ่อม แอปไม่อ่านคลังภาพเอง"
        hint="ถ่ายให้เห็นจุดที่เสียชัด ๆ และเห็นบริเวณรอบ ๆ"
        onClose={() => setCameraOpen(false)}
        onCapture={async (uri) => {
          setCameraOpen(false);
          try {
            dispatch({ type: 'setPhoto', photo: await preparePhotoForUpload(uri) });
            setErrors((e) => ({ ...e, photo: undefined }));
          } catch (e) {
            setMessage(e instanceof Error ? e.message : 'ประมวลผลรูปไม่สำเร็จ');
          }
        }}
      />
    );
  }

  const kindInfo = KIND_INFO.repair;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen scrollEnabled={!mapTouching}>
        <View style={styles.steps} accessibilityRole="progressbar" accessibilityLabel={`ขั้นที่ ${state.step} จาก 3: ${STEP_TITLES[state.step - 1]}`}>
          {STEP_TITLES.map((title, i) => (
            <View key={title} style={styles.step}>
              <View style={[styles.stepBar, i < state.step && { backgroundColor: Colors.primary }]} />
              <Text style={[styles.stepText, i + 1 === state.step && styles.stepTextActive]}>
                {i + 1}. {title}
              </Text>
            </View>
          ))}
        </View>

        {state.step === 1 ? (
          <Card>
            <SectionTitle>เรื่องอะไร</SectionTitle>
            <Text style={styles.muted}>
              ของในวิทยาเขตเสีย/ชำรุด เจ้าหน้าที่อาคารสถานที่จะรับเรื่อง และคุณจะได้แจ้งเตือนทุกครั้งที่ความคืบหน้าเปลี่ยน
            </Text>
            <Text style={styles.label}>หมวด</Text>
            <View style={styles.row}>
              {REPAIR_ORDER.map((c) => (
                <Chip
                  key={c}
                  label={categoryInfo(state.kind, c).label}
                  color={kindInfo.color}
                  selected={state.category === c}
                  onPress={() => {
                    dispatch({ type: 'setCategory', category: c });
                    setErrors({});
                  }}
                />
              ))}
            </View>
            {errors.category ? <Text style={styles.error} accessibilityRole="alert">{errors.category}</Text> : null}
          </Card>
        ) : null}

        {state.step === 2 ? (
          <>
            <Card>
              <SectionTitle>รูปปัญหา *</SectionTitle>
              <PhotoField
                photo={state.photo}
                onChange={(photo) => {
                  dispatch({ type: 'setPhoto', photo });
                  setErrors((e) => ({ ...e, photo: undefined }));
                }}
                onOpenCamera={() => setCameraOpen(true)}
                error={errors.photo}
                emptyText="ถ่ายให้เห็นจุดที่เสีย ช่างจะได้เตรียมของถูก"
              />
            </Card>
            <Card>
              <SectionTitle>ตำแหน่ง *</SectionTitle>
              <Button title={locating ? 'กำลังหาตำแหน่ง…' : 'ใช้ตำแหน่งปัจจุบัน'} icon="locate" variant="secondary" loading={locating} onPress={locate} />
              <Text style={styles.label}>หรือเลือกอาคาร</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {PICKABLE_PLACES.map((place) => (
                  <Chip
                    key={place.id}
                    label={place.shortName}
                    selected={state.point?.latitude === place.latitude && state.point?.longitude === place.longitude}
                    onPress={() => chooseBuilding(place)}
                  />
                ))}
              </ScrollView>
              <PickMap
                markers={[]}
                picked={state.point}
                onPick={(point) => {
                  dispatch({ type: 'setPoint', point });
                  setErrors((e) => ({ ...e, point: undefined }));
                }}
                height={220}
                onInteractingChange={setMapTouching}
                accessibilityLabel="แผนที่สำหรับปักหมุดจุดที่เกิดเรื่อง แตะเพื่อย้ายหมุด"
              />
              {errors.point ? (
                <Text style={styles.error} accessibilityRole="alert">{errors.point}</Text>
              ) : (
                <Text style={styles.muted}>{locationNote ?? 'แตะแผนที่ ลากหมุด หรือแตะป้ายชื่ออาคารบนแผนที่'}</Text>
              )}
              <TextField
                label="จุดสังเกต *"
                value={state.placeName}
                onChangeText={(value) => {
                  dispatch({ type: 'setField', field: 'placeName', value });
                  setErrors((e) => ({ ...e, placeName: undefined }));
                }}
                error={errors.placeName}
                placeholder="เช่น อครเก่า ชั้น 2 หน้าห้อง NK2217"
                hint="พิมพ์รหัสห้องแบบ NK2217 ได้ (NK + อาคาร + ชั้น + ห้อง)"
                maxLength={80}
              />
              {roomCode ? (
                <View style={styles.roomCode}>
                  <Text style={styles.muted}>= {roomCode.label}</Text>
                  <Button
                    title={`ปักหมุดที่${roomCode.place.shortName}`}
                    icon="business-outline"
                    variant="ghost"
                    onPress={() => {
                      dispatch({ type: 'setPoint', point: { latitude: roomCode.place.latitude, longitude: roomCode.place.longitude } });
                      setErrors((e) => ({ ...e, point: undefined }));
                    }}
                  />
                </View>
              ) : null}
            </Card>

            {duplicates.length > 0 ? (
              <Card style={styles.duplicate}>
                <SectionTitle>มีคนแจ้งเรื่องนี้ใกล้ ๆ แล้ว</SectionTitle>
                <Text style={styles.muted}>
                  กด “เจอเหมือนกัน” แทนการแจ้งซ้ำ คุณจะได้แจ้งเตือนความคืบหน้า และเจ้าหน้าที่เห็นว่าเรื่องนี้กระทบหลายคน
                </Text>
                {duplicates.slice(0, 3).map(({ ticket, distance }) => (
                  <View key={ticket.id} style={{ gap: Spacing.sm }}>
                    <TicketCard ticket={ticket} onOpen={(id) => router.push({ pathname: '/tickets/[id]', params: { id } })} />
                    <Text style={styles.muted}>ห่างจากจุดที่คุณปัก {formatDistance(distance)}</Text>
                    {ticket.reporterId === session?.user.id || ticket.following ? (
                      <Text style={styles.muted}>คุณติดตามเรื่องนี้อยู่แล้ว</Text>
                    ) : isStaff ? null : (
                      <Button
                        title="เจอเหมือนกัน (ไม่แจ้งซ้ำ)"
                        icon="people"
                        variant="secondary"
                        loading={followingId === ticket.id}
                        disabled={followingId !== null}
                        onPress={() => follow(ticket.id)}
                      />
                    )}
                  </View>
                ))}
              </Card>
            ) : null}
          </>
        ) : null}

        {state.step === 3 ? (
          <Card>
            <SectionTitle>รายละเอียด</SectionTitle>
            <TextField
              label="หัวข้อ *"
              value={state.title}
              onChangeText={(value) => {
                dispatch({ type: 'setField', field: 'title', value });
                setErrors((e) => ({ ...e, title: undefined }));
              }}
              error={errors.title}
              placeholder="เช่น ไฟทางเดินดับ 3 ดวง"
              maxLength={80}
            />
            <TextField
              label="รายละเอียดเพิ่มเติม"
              value={state.detail}
              onChangeText={(value) => dispatch({ type: 'setField', field: 'detail', value })}
              error={errors.detail}
              multiline
              style={styles.multiline}
              maxLength={500}
              placeholder="เสียตั้งแต่เมื่อไร อันตรายไหม"
            />
            <Banner tone="info" icon="notifications">
              คุณจะได้แจ้งเตือนเมื่อเจ้าหน้าที่รับเรื่อง นัดเวลา และซ่อมเสร็จ
            </Banner>
          </Card>
        ) : null}

        {message ? <Banner tone="danger">{message}</Banner> : null}

        <View style={styles.row}>
          {state.step > 1 ? (
            <View style={styles.flex}>
              <Button title="ย้อนกลับ" icon="chevron-back" variant="secondary" onPress={() => dispatch({ type: 'back' })} />
            </View>
          ) : null}
          <View style={styles.flex}>
            {state.step < 3 ? (
              <Button title="ถัดไป" icon="chevron-forward" onPress={next} />
            ) : (
              <Button title={submitting ? 'กำลังส่ง…' : `ส่ง${kindInfo.label}`} icon="send" loading={submitting} onPress={submit} />
            )}
          </View>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  steps: { flexDirection: 'row', gap: Spacing.sm },
  step: { flex: 1, gap: 4 },
  stepBar: { height: 4, borderRadius: 2, backgroundColor: Colors.border },
  stepText: { fontSize: 12, color: Colors.textMuted },
  stepTextActive: { color: Colors.text, fontWeight: '700' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  flex: { flex: 1, minWidth: 130 },
  label: { fontSize: 14, fontWeight: '600', color: Colors.text },
  muted: { fontSize: 13, color: Colors.textMuted, lineHeight: 18 },
  error: { fontSize: 13, color: Colors.danger },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  duplicate: { borderColor: Colors.warning, backgroundColor: Colors.warningSoft },
  chipRow: { gap: Spacing.sm, paddingVertical: 2 },
  roomCode: { gap: 4 },
});
