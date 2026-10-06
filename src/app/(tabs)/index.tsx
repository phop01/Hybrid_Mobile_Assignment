// หน้าแรก "วันนี้ในมอ": เปิดแอปแล้วเห็นทุกเรื่องที่เกี่ยวกับตัวเองวันนี้ในที่เดียว
// (แทนการไล่ดูกลุ่ม LINE / เพจ / บอร์ดหน้าตึกทีละที่) และรวมรายการกิจกรรมทั้งหมดไว้ด้านล่าง
// ลำดับ: หัวหน้า → ค้นหา/ตัวกรอง → การ์ดใหญ่ (เรื่องสำคัญที่สุดตอนนี้) → ที่ลงทะเบียนไว้ → กิจกรรมทั้งหมด

import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ActivityBrowser } from '@/components/activity-browser';
import { ActivityRow } from '@/components/activity-tile';
import { Text } from '@/components/app-text';
import { HeroCard } from '@/components/hero-card';
import { TopBar } from '@/components/top-bar';
import { Button, Card, OfflineBanner, Screen, SectionHeader, StatPill, type IconName } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useRefreshControl } from '@/hooks/use-refresh-control';
import { summarizeAttendance } from '@/lib/attendance';
import { isEnded } from '@/lib/filter-activities';
import { formatDate, formatTime } from '@/lib/format';
import { useActivities } from '@/state/activities-context';
import { useMyRegistrations } from '@/state/my-registrations-context';
import { useAuthenticatedSession } from '@/state/session-context';
import type { Activity } from '@/types/models';

const openActivity = (id: string) => router.push({ pathname: '/activities/[id]', params: { id } });
const CAMPUS = 'มข. วิทยาเขตหนองคาย';

export default function TodayScreen() {
  const session = useAuthenticatedSession();
  const activitiesState = useActivities();
  const registrationsState = useMyRegistrations();
  const refreshAll = useCallback(
    () => Promise.allSettled([activitiesState.refresh(), registrationsState.refresh()]),
    [activitiesState, registrationsState],
  );
  const refreshControl = useRefreshControl(refreshAll);
  const upcoming = activitiesState.activities.filter((a) => !isEnded(a)).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const today = formatDate(new Date().toISOString());
  const { offlineSince } = activitiesState;

  if (!session) {
    return (
      <ActivityBrowser
        onRefresh={refreshAll}
        top={<TopBar eyebrow="KKUNK TODAY" title="สวัสดี" subtitle={`${today} · ${CAMPUS}`} />}
        header={
          <>
            <HeroCard
              imageUrl={upcoming[0]?.imageUrl}
              tag={CAMPUS}
              eyebrow="CAMPUS LIFE"
              title={'กิจกรรมในมอทั้งหมด\nอยู่ในแอปเดียว'}
              subtitle="กิจกรรม จิตอาสา และชั่วโมงสะสมของคุณ">
              <StatPill tone="accent" icon="calendar" label={`${upcoming.length} กิจกรรมเปิดรับ`} />
            </HeroCard>
            <View style={styles.tiles}>
              <Tile icon="calendar" label="กิจกรรม" text="ลงทะเบียน เช็กอิน สะสมชั่วโมง" />
              <Tile icon="heart" label="จิตอาสา" text="กิจกรรมจิตอาสา นับชั่วโมงให้" />
              <Tile icon="map" label="แผนที่" text="หาทาง นำทางไปกิจกรรม" />
              <Tile icon="notifications" label="แจ้งเตือน" text="รู้ทันทีเมื่อตรวจหลักฐานแล้ว" />
            </View>
            <Button title="เข้าสู่ระบบ" icon="log-in-outline" onPress={() => router.push('/login')} />
          </>
        }
      />
    );
  }

  const { user } = session;
  const firstName = user.fullName.split(' ')[0];

  // เจ้าหน้าที่กิจกรรม: งานหลักอยู่ที่แท็บจัดการ หน้าแรกจึงเป็นทางลัด + กิจกรรมที่กำลังมา
  if (user.role === 'organizer') {
    const mine = upcoming.filter((a) => a.organizerId === user.id);
    return (
      <Screen refreshControl={refreshControl}>
        <TopBar eyebrow="KKUNK TODAY · เจ้าหน้าที่" title={`${greeting()}, ${firstName}`} subtitle={`${today} · ${CAMPUS}`} />
        <HeroCard
          imageUrl={mine[0]?.imageUrl ?? upcoming[0]?.imageUrl}
          eyebrow="ORGANIZER"
          title="จัดการกิจกรรมและตรวจหลักฐาน"
          onPress={() => router.navigate('/manage')}
          actionLabel="ไปหน้าจัดการ">
          <StatPill tone="accent" icon="clipboard" label={`กิจกรรมของฉัน ${mine.length}`} />
          <StatPill tone="dark" icon="calendar" label={`ทั้งวิทยาเขต ${upcoming.length}`} />
        </HeroCard>
        <OfflineBanner since={offlineSince} />
        <View style={styles.actions}>
          <QuickAction icon="clipboard" label="ตรวจหลักฐาน" onPress={() => router.navigate('/manage')} />
          <QuickAction icon="add-circle" label="สร้างกิจกรรม" onPress={() => router.push('/organizer/new')} />
        </View>
        <ActivityList eyebrow="UPCOMING" title="กิจกรรมที่กำลังจะมาถึง" activities={upcoming.slice(0, 5)} />
      </Screen>
    );
  }

  // ---------- นักศึกษา ----------
  const { registrations } = registrationsState;
  const myUpcoming = registrations
    .filter((r) => r.status === 'registered' || r.status === 'pending_review')
    .map((r) => ({
      registration: r,
      activity: activitiesState.getById(r.activityId),
    }))
    .filter((x): x is { registration: typeof x.registration; activity: Activity } => !!x.activity && !isEnded(x.activity))
    .sort((a, b) => a.activity.startsAt.localeCompare(b.activity.startsAt));
  const summary = summarizeAttendance(registrations, activitiesState.activities);
  const next = myUpcoming[0];
  const hoursPill = <StatPill tone="accent" icon="ribbon" label={`สะสม ${summary.hours} ชม.`} />;

  return (
    <ActivityBrowser
      onRefresh={refreshAll}
      top={<TopBar eyebrow="KKUNK TODAY · วันนี้ในมอ" title={`${greeting()}, ${firstName}`} subtitle={`${today} · ${CAMPUS}`} />}
      header={
        <>
          {/* การ์ดใหญ่: มีกิจกรรมที่ลงไว้ → กิจกรรมถัดไป (แตะไปเช็กอิน) · ไม่มี → สรุปชั่วโมงและจำนวนกิจกรรมที่เปิดรับ */}
          {next ? (
            <HeroCard
              imageUrl={next.activity.imageUrl}
              tag={next.activity.location.name}
              eyebrow="NEXT UP · กิจกรรมถัดไปของคุณ"
              title={next.activity.title}
              subtitle={`${formatDate(next.activity.startsAt)} · ${formatTime(next.activity.startsAt)}`}
              onPress={() =>
                router.push({
                  pathname: '/registrations/[id]',
                  params: { id: next.registration.id },
                })
              }
              actionLabel={`ดูการลงทะเบียน ${next.activity.title} และเช็กอิน`}>
              {hoursPill}
              <StatPill tone="dark" icon="ticket" label={`ลงทะเบียนแล้ว ${myUpcoming.length}`} />
            </HeroCard>
          ) : (
            <HeroCard
              imageUrl={upcoming[0]?.imageUrl}
              tag={CAMPUS}
              eyebrow="DISCOVER"
              title={'ออกไปหา\nกิจกรรมดี ๆ วันนี้'}
              subtitle="ลงทะเบียน เข้าร่วม แล้วสะสมชั่วโมง">
              {hoursPill}
              <StatPill tone="dark" icon="calendar" label={`${upcoming.length} กิจกรรมเปิดรับ`} />
            </HeroCard>
          )}


          {myUpcoming.length > 1 ? (
            <Card>
              <SectionHeader eyebrow="MY SCHEDULE" title="ที่ลงทะเบียนไว้" actionLabel="ดูทั้งหมด" onAction={() => router.push('/my')} />
              {myUpcoming.slice(1, 4).map(({ registration, activity }) => (
                <ActivityRow
                  key={registration.id}
                  activity={activity}
                  accessibilityLabel={`${activity.title} ${formatDate(activity.startsAt)} ${formatTime(activity.startsAt)} แตะเพื่อดูและเช็กอิน`}
                  onPress={() =>
                    router.push({
                      pathname: '/registrations/[id]',
                      params: { id: registration.id },
                    })
                  }
                />
              ))}
            </Card>
          ) : null}
        </>
      }
    />
  );
}

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? 'สวัสดีตอนเช้า' : hour < 17 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนเย็น';
}

function ActivityList({ eyebrow, title, activities }: { eyebrow: string; title: string; activities: Activity[] }) {
  if (activities.length === 0) return null;
  return (
    <Card>
      <SectionHeader eyebrow={eyebrow} title={title} />
      {activities.map((a) => (
        <ActivityRow key={a.id} activity={a} onPress={() => openActivity(a.id)} />
      ))}
    </Card>
  );
}

function QuickAction({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.quick, pressed && { opacity: 0.8 }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}>
      <View style={styles.quickIcon}>
        <Ionicons name={icon} size={22} color={Colors.primary} />
      </View>
      <Text style={styles.quickText}>{label}</Text>
    </Pressable>
  );
}

function Tile({ icon, label, text }: { icon: IconName; label: string; text: string }) {
  return (
    <View style={styles.tile}>
      <View style={styles.tileIcon}>
        <Ionicons name={icon} size={18} color={Colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.tileTitle}>{label}</Text>
        <Text style={styles.tileText} numberOfLines={2}>
          {text}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  tile: {
    flexGrow: 1,
    flexBasis: 150,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  tileIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileTitle: { fontSize: 14, fontWeight: '700', color: Colors.text },
  tileText: { fontSize: 11, color: Colors.textMuted, lineHeight: 15 },
  muted: { fontSize: 13, color: Colors.textMuted, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  quick: {
    flex: 1,
    minHeight: 76,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
  },
  quickIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
});
