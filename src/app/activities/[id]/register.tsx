import { router, useLocalSearchParams } from 'expo-router';
import { useReducer, useRef } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, type TextInput } from 'react-native';

import { Banner, Button, Card, Screen, SectionTitle, StateView, TextField } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { firstParam, useActivity } from '@/hooks/use-activity';
import { formatDateRange } from '@/lib/format';
import { newIdempotencyKey } from '@/lib/platform-actions';
import { hasErrors, validateRegistration } from '@/lib/validate-registration';
import { ApiError } from '@/services/api-client';
import { ensureNotificationPermission, supportsNotifications } from '@/services/reminders';
import { useMyRegistrations } from '@/state/my-registrations-context';
import { initialFormState, registrationFormReducer } from '@/state/registration-form-reducer';
import { useAuthenticatedSession } from '@/state/session-context';
import { Text } from '@/components/app-text';
import { hapticError, hapticSuccess } from '@/lib/haptics';

export default function RegisterScreen() {
  const id = firstParam(useLocalSearchParams<{ id?: string | string[] }>().id);
  const activityState = useActivity(id);
  const session = useAuthenticatedSession();
  const { register, findActiveForActivity } = useMyRegistrations();

  // เติมชื่อ รหัส คณะ จากโปรไฟล์ ไม่ต้องพิมพ์ซ้ำทุกกิจกรรม
  const [state, dispatch] = useReducer(
    registrationFormReducer,
    initialFormState({
      fullName: session?.user.fullName ?? '',
      studentId: session?.user.studentId ?? '',
      faculty: session?.user.faculty ?? '',
      phone: '',
      dietary: '',
    }),
  );
  // key เดิมตลอดการเปิดฟอร์มนี้: เน็ตหลุดแล้วกดส่งใหม่ server จะไม่สร้างรายการซ้ำ
  const idempotencyKey = useRef(newIdempotencyKey()).current;
  const phoneRef = useRef<TextInput>(null);
  const dietaryRef = useRef<TextInput>(null);

  if (activityState.status === 'loading') return <StateView kind="loading" />;
  if (activityState.status !== 'ready') {
    return <StateView kind="empty" title="ไม่พบกิจกรรมนี้" actionLabel="กลับ" onAction={() => router.back()} />;
  }
  const { activity } = activityState;

  // ลงทะเบียนสำเร็จแล้ว: กำลังพาไปหน้าการลงทะเบียนของฉัน (ตั้งเตือนให้ไปเช็กอินได้ที่นั่น)
  if (state.phase === 'done') return <StateView kind="loading" />;

  const existing = findActiveForActivity(activity.id);
  if (existing) {
    return (
      <StateView
        kind="empty"
        icon="checkmark-circle-outline"
        title={existing.status === 'rejected' ? 'การลงทะเบียนของคุณไม่ได้รับอนุมัติ' : 'คุณลงทะเบียนกิจกรรมนี้แล้ว'}
        actionLabel="ดูการลงทะเบียน"
        onAction={() => router.replace({ pathname: '/registrations/[id]', params: { id: existing.id } })}
      />
    );
  }

  const clientErrors = validateRegistration(state.values);
  const errors = { ...(state.showErrors ? clientErrors : {}), ...state.serverErrors };
  const set = (field: keyof typeof state.values) => (value: string) => dispatch({ type: 'change', field, value });

  const submit = async () => {
    // กันกดซ้ำระหว่างส่ง
    if (state.phase === 'submitting') return;
    if (hasErrors(clientErrors)) {
      hapticError();
      return dispatch({ type: 'invalid' });
    }
    dispatch({ type: 'submit' });
    try {
      const registration = await register(activity.id, state.values, idempotencyKey);
      dispatch({ type: 'success', registration });
      hapticSuccess();
      // แทนที่ฟอร์มด้วยหน้าการลงทะเบียนของฉัน (กดกลับ = หน้ารายละเอียดกิจกรรม) → ข้อความสำเร็จ + การ์ดตั้งเตือน
      router.replace({ pathname: '/registrations/[id]', params: { id: registration.id, registered: '1' } });
      // ขอสิทธิ์แจ้งเตือนตอนนี้ เพราะเพิ่งลงทะเบียน ผู้ใช้เข้าใจว่าจะได้รับประกาศของกิจกรรมนี้
      // เว็บ: เบราว์เซอร์ให้ขอสิทธิ์ได้เฉพาะตอนผู้ใช้กดปุ่ม จึงไปขอตอนกด "ตั้งแจ้งเตือน" แทน
      if (supportsNotifications && Platform.OS !== 'web') ensureNotificationPermission().catch(() => undefined);
    } catch (e) {
      hapticError();
      if (e instanceof ApiError) {
        dispatch({ type: 'failure', message: e.message, fieldErrors: e.fields });
      } else {
        dispatch({ type: 'failure', message: 'ลงทะเบียนไม่สำเร็จ กรุณาลองใหม่' });
      }
    }
  };

  const submitting = state.phase === 'submitting';

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Screen>
        <Card>
          <SectionTitle>{activity.title}</SectionTitle>
          <Text style={styles.muted}>{formatDateRange(activity.startsAt, activity.endsAt)}</Text>
          <Text style={styles.muted}>{activity.location.name}</Text>
        </Card>

        <Card>
          <TextField label="ชื่อ-นามสกุล" value={state.values.fullName} onChangeText={set('fullName')} error={errors.fullName} editable={!submitting} autoComplete="name" />
          <TextField
            label="รหัสนักศึกษา"
            value={state.values.studentId}
            onChangeText={(t) => set('studentId')(t.replace(/\D/g, '').slice(0, 10))}
            error={errors.studentId}
            editable={!submitting}
            keyboardType="number-pad"
          />
          <TextField label="คณะ" value={state.values.faculty} onChangeText={set('faculty')} error={errors.faculty} editable={!submitting} returnKeyType="next" onSubmitEditing={() => phoneRef.current?.focus()} />
          <TextField
            ref={phoneRef}
            label="เบอร์โทรศัพท์"
            hint="ผู้จัดใช้ติดต่อกรณีกิจกรรมเปลี่ยนแปลง"
            value={state.values.phone}
            onChangeText={(t) => set('phone')(t.replace(/\D/g, '').slice(0, 10))}
            error={errors.phone}
            editable={!submitting}
            keyboardType="phone-pad"
            autoComplete="tel"
            returnKeyType="next"
            onSubmitEditing={() => dietaryRef.current?.focus()}
          />
          <TextField
            ref={dietaryRef}
            label="ข้อจำกัดด้านอาหาร (ถ้ามี)"
            hint="เช่น มังสวิรัติ ฮาลาล แพ้อาหารทะเล ผู้จัดใช้เตรียมอาหารให้ถูก"
            value={state.values.dietary}
            onChangeText={set('dietary')}
            error={errors.dietary}
            editable={!submitting}
            multiline
          />
        </Card>

        {state.message ? <Banner tone="danger">{state.message}</Banner> : null}
        <Button title={submitting ? 'กำลังส่ง…' : 'ยืนยันลงทะเบียน'} icon="checkmark" loading={submitting} onPress={submit} />
        <Text style={[styles.muted, { textAlign: 'center' }]}>ลงทะเบียนแล้วจะกันที่นั่งไว้ให้ ถ้าไม่ไปกรุณายกเลิก เพื่อให้คนอื่นได้ที่นั่ง</Text>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  muted: { fontSize: 14, color: Colors.textMuted, lineHeight: 20, marginTop: -Spacing.xs },
});
