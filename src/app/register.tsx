// สมัครสมาชิก (สัปดาห์ 5 ฟอร์ม + สัปดาห์ 8 Authentication)
// เลือกบทบาทได้มากกว่า 1 (นักศึกษา / เจ้าหน้าที่กิจกรรม / เจ้าหน้าที่อาคาร) เช่น บุคลากรที่เรียนต่อด้วย
// ใช้งานทีละบทบาท เปลี่ยนได้ที่แท็บ "ฉัน" · server ตรวจสิทธิ์ตามบทบาทที่ใช้อยู่ทุก request

import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';

import { HeroCard } from '@/components/hero-card';
import { SelectField } from '@/components/select-field';
import { Banner, Button, Card, Screen, SectionHeader, TextField } from '@/components/ui';
import { Colors, MinTouch, Radius, Spacing } from '@/constants/theme';
import { safeNext, validateSignUp, type SignUpErrors, type SignUpValues } from '@/lib/auth-validation';
import { MAJORS } from '@/lib/majors';
import { ROLE_INFO, ROLE_ORDER } from '@/lib/roles';
import { ApiError } from '@/services/api-client';
import { setPostLoginRedirect, useSession } from '@/state/session-context';
import type { AccountRole } from '@/types/models';
import { Text } from '@/components/app-text';

export default function RegisterScreen() {
  const { signUp } = useSession();
  const params = useLocalSearchParams<{ next?: string }>();
  const [values, setValues] = useState<SignUpValues>({
    studentId: '',
    fullName: '',
    faculty: '',
    major: '',
    password: '',
    confirm: '',
    roles: ['student'],
  });
  const [errors, setErrors] = useState<SignUpErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const roles = values.roles ?? ['student'];
  const staff = roles.some((r) => r !== 'student');
  const student = roles.includes('student');
  const unitHint = ROLE_INFO[roles.find((r) => r !== 'student') ?? 'student'].unitHint;

  const set = (field: Exclude<keyof SignUpValues, 'roles'>) => (text: string) => {
    setValues((v) => ({ ...v, [field]: field === 'studentId' ? text.replace(/\D/g, '').slice(0, 10) : text }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  // บัญชีหนึ่งมีบทบาทเดียว
  const chooseRole = (role: AccountRole) => {
    setValues((v) => ({ ...v, roles: [role] }));
    setErrors((e) => ({ ...e, roles: undefined }));
  };

  const submit = async () => {
    if (submitting) return;
    const found = validateSignUp(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSubmitting(true);
    setError(null);
    try {
      setPostLoginRedirect(safeNext(params.next));
      const { confirm: _confirm, ...input } = values;
      await signUp({ ...input, fullName: input.fullName.trim(), faculty: input.faculty.trim(), major: (student && input.major) || undefined });
    } catch (e) {
      setPostLoginRedirect(null);
      if (e instanceof ApiError) setErrors(e.fields as SignUpErrors);
      setError(e instanceof Error ? e.message : 'สมัครสมาชิกไม่สำเร็จ');
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <HeroCard
          tag="มข. วิทยาเขตหนองคาย"
          eyebrow="JOIN KKUNK TODAY"
          title={'สมัครสมาชิก'}
          subtitle="ใช้รหัสนักศึกษาหรือรหัสบุคลากร ลงทะเบียนกิจกรรมและรับแจ้งเตือนได้ทันที"
        />
        <Card>
          <SectionHeader eyebrow="SIGN UP" title="ข้อมูลบัญชี" />
          <View style={styles.types}>
            <Text style={styles.typesTitle}>บทบาทของคุณ (เลือก 1 บทบาท)</Text>
            <View style={styles.row}>
              {ROLE_ORDER.map((role) => {
                const info = ROLE_INFO[role];
                const selected = roles.includes(role);
                return (
                  <Pressable
                    key={role}
                    onPress={() => chooseRole(role)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    accessibilityLabel={info.label}
                    style={({ pressed }) => [styles.type, selected && styles.typeSelected, pressed && { opacity: 0.8 }]}>
                    <View style={styles.typeHead}>
                      <Ionicons name={info.icon} size={22} color={selected ? Colors.onPrimary : Colors.primary} />
                      <Ionicons
                        name={selected ? 'radio-button-on' : 'radio-button-off'}
                        size={20}
                        color={selected ? Colors.onPrimary : Colors.textMuted}
                      />
                    </View>
                    <Text style={[styles.typeLabel, selected && { color: Colors.onPrimary }]}>{info.label}</Text>
                    <Text style={[styles.typeDetail, selected && { color: Colors.onPrimaryMuted }]} numberOfLines={2}>
                      {info.detail}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {errors.roles ? (
              <Text style={styles.error} accessibilityRole="alert">
                {errors.roles}
              </Text>
            ) : null}
          </View>
          <TextField
            label={staff ? (student ? 'รหัสนักศึกษา / รหัสบุคลากร' : 'รหัสบุคลากร') : 'รหัสนักศึกษา'}
            value={values.studentId}
            onChangeText={set('studentId')}
            error={errors.studentId}
            keyboardType="number-pad"
            placeholder={staff && !student ? 'เช่น 1000000009' : 'เช่น 6601234567'}
          />
          <TextField label="ชื่อ-นามสกุล" value={values.fullName} onChangeText={set('fullName')} error={errors.fullName} autoComplete="name" />
          {/* เจ้าหน้าที่มีบทบาทเดียว (งานกิจกรรมนักศึกษา) จึงไม่ต้องกรอกหน่วยงาน */}
          {student ? (
            <>
              <TextField
                label="คณะ"
                value={values.faculty}
                onChangeText={set('faculty')}
                error={errors.faculty}
                placeholder={unitHint}
                hint="ใช้เติมฟอร์มลงทะเบียนกิจกรรมให้อัตโนมัติ"
              />
              <SelectField
                label="สาขาวิชา (ไม่บังคับ)"
                value={values.major ?? ''}
                options={MAJORS}
                onChange={(major) => {
                  setValues((v) => ({ ...v, major }));
                  setErrors((e) => ({ ...e, major: undefined }));
                }}
                placeholder="แตะเพื่อเลือกสาขา"
                error={errors.major}
              />
            </>
          ) : null}
          <TextField
            label="รหัสผ่าน"
            value={values.password}
            onChangeText={set('password')}
            error={errors.password}
            secureTextEntry
            autoComplete="new-password"
            hint="อย่างน้อย 8 ตัวอักษร"
          />
          <TextField
            label="ยืนยันรหัสผ่าน"
            value={values.confirm}
            onChangeText={set('confirm')}
            error={errors.confirm}
            secureTextEntry
            onSubmitEditing={submit}
          />
          {error ? <Banner tone="danger">{error}</Banner> : null}
          <Button
            title={submitting ? 'กำลังสมัคร…' : 'สมัครสมาชิก'}
            onPress={submit}
            loading={submitting}
          />
          <Link href={{ pathname: '/login', params: params.next ? { next: params.next } : {} }} replace style={styles.link}>
            มีบัญชีแล้ว? เข้าสู่ระบบ
          </Link>
        </Card>
        <Banner tone="info" icon="shield-checkmark-outline">
          รหัสผ่านถูกเข้ารหัส (scrypt) ที่ server แอปเก็บเฉพาะ token ไว้ใน SecureStore ของเครื่อง
        </Banner>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  link: { color: Colors.primary, fontSize: 15, fontWeight: '600', textAlign: 'center', paddingVertical: Spacing.md },
  types: { gap: Spacing.sm, backgroundColor: Colors.primarySoft, borderRadius: Radius.md, padding: Spacing.md },
  typesTitle: { fontSize: 13, fontWeight: '700', color: Colors.primaryDark },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  type: {
    flexGrow: 1,
    flexBasis: 150,
    minHeight: MinTouch * 2,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
    gap: 2,
  },
  typeSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  error: { fontSize: 13, color: Colors.danger },
  typeLabel: { fontSize: 15, fontWeight: '700', color: Colors.text },
  typeDetail: { fontSize: 12, color: Colors.textMuted, lineHeight: 16 },
});
