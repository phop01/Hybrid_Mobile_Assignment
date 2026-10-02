// แท็บ "จัดการ" ของผู้จัดกิจกรรม: กิจกรรมที่ฉันจัด + ตัวเลขสรุป + รายการรอตรวจ

import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { LoginPrompt } from '@/components/login-prompt';
import { Banner, Button, Card, Screen, SectionTitle, StateView } from '@/components/ui';
import { Colors, MinTouch, Radius, Spacing } from '@/constants/theme';
import { useNow } from '@/hooks/use-now';
import { useOrganizerActivities } from '@/hooks/use-organizer';
import { CATEGORIES } from '@/lib/categories';
import { formatDateRange } from '@/lib/format';
import { useOrganizerSession } from '@/state/session-context';
import type { OrganizerActivity } from '@/types/models';
import { Text } from '@/components/app-text';

export default function ManageScreen() {
  const session = useOrganizerSession();
  if (!session) {
    return (
      <LoginPrompt
        icon="clipboard-outline"
        title="สำหรับผู้จัดกิจกรรม"
        message="เข้าสู่ระบบด้วยบัญชีบุคลากรเพื่อสร้างกิจกรรมและตรวจหลักฐานการเข้าร่วม"
        next="/manage"
      />
    );
  }
  return <ManageList />;
}

function ManageList() {
  const { data: activities, loading, error, reload } = useOrganizerActivities();
  const now = useNow(60000);
  // ยกเลิกแล้ว = ไม่ต้องจัดการต่อ ไปอยู่กลุ่มที่ผ่านมา
  const upcoming = activities.filter((a) => !a.cancelledAt && new Date(a.endsAt).getTime() >= now);
  const past = activities.filter((a) => a.cancelledAt || new Date(a.endsAt).getTime() < now);
  const pendingTotal = activities.reduce((sum, a) => sum + a.stats.pendingReview, 0);

  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={loading && activities.length > 0} onRefresh={reload} tintColor={Colors.primary} />
      }>
      <Button title="สร้างกิจกรรมใหม่" icon="add-circle" onPress={() => router.push('/organizer/new')} />
      {pendingTotal > 0 ? (
        <Banner tone="warning" icon="hourglass">
          มีหลักฐานใบเซ็นชื่อรอตรวจ {pendingTotal} รายการ นักศึกษาจะได้ชั่วโมงเมื่อคุณตรวจผ่าน
        </Banner>
      ) : null}
      {error ? <Banner tone="danger">{error}</Banner> : null}

      {loading && activities.length === 0 ? (
        <StateView kind="loading" message="กำลังโหลดกิจกรรมของคุณ…" />
      ) : activities.length === 0 ? (
        <StateView
          kind="empty"
          icon="calendar-outline"
          title="ยังไม่มีกิจกรรม"
          message="กด สร้างกิจกรรมใหม่ เพื่อเริ่มรับลงทะเบียน"
        />
      ) : (
        <>
          <SectionTitle>กำลังจะมาถึง / กำลังจัด ({upcoming.length})</SectionTitle>
          {upcoming.map((a) => (
            <ManageCard key={a.id} activity={a} />
          ))}
          {past.length > 0 ? <SectionTitle>จบแล้ว ({past.length})</SectionTitle> : null}
          {past.map((a) => (
            <ManageCard key={a.id} activity={a} />
          ))}
        </>
      )}
    </Screen>
  );
}

function ManageCard({ activity }: { activity: OrganizerActivity }) {
  const { stats } = activity;
  const category = CATEGORIES[activity.category];
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/organizer/[id]', params: { id: activity.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${activity.title}, ลงทะเบียน ${stats.registered} คน, เข้าร่วมแล้ว ${stats.checkedIn} คน, รอตรวจ ${stats.pendingReview} รายการ`}
      accessibilityHint="เปิดรายชื่อผู้เข้าร่วมและตรวจหลักฐาน"
      style={({ pressed }) => [pressed && { opacity: 0.85 }]}>
      <Card>
        <View style={styles.top}>
          <View style={[styles.dot, { backgroundColor: category.color }]} />
          <Text style={styles.title} numberOfLines={2}>
            {activity.title}
          </Text>
          <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
        </View>
        <Text style={styles.muted}>
          {formatDateRange(activity.startsAt, activity.endsAt)} · {activity.hours} ชม. ·{' '}
          {activity.cancelledAt ? 'ยกเลิกแล้ว' : activity.checkInMethod === 'paper' ? 'ใบเซ็นชื่อ' : 'ถ่ายรูปที่งาน'}
        </Text>
        <View style={styles.stats}>
          <Stat label="ลงทะเบียน" value={`${stats.registered}/${activity.capacity}`} tone="primary" />
          <Stat label="เข้าร่วมแล้ว" value={String(stats.checkedIn)} tone="success" />
          <Stat
            label="รอตรวจ"
            value={String(stats.pendingReview)}
            tone={stats.pendingReview > 0 ? 'warning' : 'neutral'}
          />
        </View>
      </Card>
    </Pressable>
  );
}

// ช่องตัวเลขแต่ละแบบมีสีพื้นของตัวเอง มองแวบเดียวก็รู้ว่าช่องไหนต้องสนใจ (รอตรวจ = สีส้ม)
const STAT_TONES = {
  primary: { bg: Colors.primarySoft, fg: Colors.primaryDark },
  success: { bg: Colors.successSoft, fg: Colors.success },
  warning: { bg: Colors.warningSoft, fg: Colors.warning },
  neutral: { bg: Colors.background, fg: Colors.textMuted },
} as const;

function Stat({ label, value, tone }: { label: string; value: string; tone: keyof typeof STAT_TONES }) {
  const t = STAT_TONES[tone];
  return (
    <View style={[styles.stat, { backgroundColor: t.bg }]}>
      <Text style={[styles.statValue, { color: t.fg }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: MinTouch - 12 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  title: { flex: 1, fontSize: 17, fontWeight: '700', color: Colors.text },
  muted: { fontSize: 13, color: Colors.textMuted, lineHeight: 18 },
  stats: { flexDirection: 'row', gap: Spacing.sm },
  stat: { flex: 1, alignItems: 'center', borderRadius: Radius.md, paddingVertical: Spacing.sm },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 13, fontWeight: '600' },
});
