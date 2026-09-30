import { Link, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';

import { Banner, Button, Card, Screen, SectionTitle, TextField } from '@/components/ui';
import { safeNext } from '@/lib/auth-validation';
import { ROLE_INFO } from '@/lib/roles';
import { Colors, Spacing } from '@/constants/theme';
import { setPostLoginRedirect, useSession } from '@/state/session-context';
import type { AccountRole } from '@/types/models';

/** บัญชีตัวอย่างในข้อมูลเริ่มต้นของ server (server/seed.mjs) บทบาทละ 1 บัญชี กดแล้วเติมรหัสให้ */
const SAMPLE_ACCOUNTS: { role: AccountRole; studentId: string; password: string }[] = [
  { role: 'student', studentId: '6609876543', password: 'campus1234' },
  { role: 'activities', studentId: '1000000001', password: 'organizer1234' },
  { role: 'facilities', studentId: '1000000002', password: 'organizer1234' },
];

export default function LoginScreen() {
  const { signIn } = useSession();
  const params = useLocalSearchParams<{ next?: string }>();
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (submitting) return;
    if (!/^\d{10}$/.test(studentId) || password.length === 0) {
      setError('กรอกรหัส 10 หลักและรหัสผ่าน');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      // จำหน้าที่ผู้ใช้ตั้งใจจะไป (เช่น ฟอร์มลงทะเบียน) แล้วพาไปหลัง login สำเร็จ
      // ให้ root layout เป็นคนพาไป เพราะหน้า login จะถูกปิดอัตโนมัติเมื่อ Stack.Protected เปลี่ยน
      setPostLoginRedirect(safeNext(params.next));
      await signIn(studentId, password);
      // ไม่เก็บรหัสผ่านไว้ใน state หลังส่งแล้ว
      setPassword('');
    } catch (e) {
      setPostLoginRedirect(null);
      setError(e instanceof Error ? e.message : 'เข้าสู่ระบบไม่สำเร็จ');
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <Card>
          <SectionTitle>เข้าสู่ระบบ NK Today</SectionTitle>
          <Text style={styles.muted}>มหาวิทยาลัยขอนแก่น วิทยาเขตหนองคาย</Text>
          <Text style={styles.muted}>นักศึกษาใช้รหัสนักศึกษา ผู้จัดกิจกรรมใช้รหัสบุคลากร</Text>
          <TextField
            label="รหัสนักศึกษา / รหัสบุคลากร"
            value={studentId}
            onChangeText={(t) => setStudentId(t.replace(/\D/g, '').slice(0, 10))}
            keyboardType="number-pad"
            autoComplete="username"
            textContentType="username"
            returnKeyType="next"
            placeholder="เช่น 6601234567"
          />
          <TextField
            label="รหัสผ่าน"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={submit}
          />
          {error ? <Banner tone="danger">{error}</Banner> : null}
          <Button title={submitting ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'} onPress={submit} loading={submitting} />
          <Link href={{ pathname: '/register', params: params.next ? { next: params.next } : {} }} replace style={styles.link}>
            ยังไม่มีบัญชี? สมัครสมาชิก
          </Link>
        </Card>

        <Card>
          <SectionTitle>บัญชีตัวอย่าง</SectionTitle>
          <Text style={styles.muted}>แตะเพื่อเติมรหัสให้ แล้วกด “เข้าสู่ระบบ”</Text>
          <View style={styles.samples}>
            {SAMPLE_ACCOUNTS.map((a) => (
              <Button
                key={a.role}
                title={`${ROLE_INFO[a.role].label} (${a.studentId})`}
                icon={ROLE_INFO[a.role].icon}
                variant="secondary"
                onPress={() => {
                  setStudentId(a.studentId);
                  setPassword(a.password);
                  setError(null);
                }}
              />
            ))}
          </View>
        </Card>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  muted: { fontSize: 14, color: Colors.textMuted, lineHeight: 20, marginBottom: Spacing.xs },
  samples: { gap: Spacing.sm },
  link: { color: Colors.primary, fontSize: 15, fontWeight: '600', textAlign: 'center', paddingVertical: Spacing.md },
});
