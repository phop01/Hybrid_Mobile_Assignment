// หน้าแรก "วันนี้ในมอ": เปิดแอปแล้วเห็นทุกเรื่องที่เกี่ยวกับตัวเองวันนี้ในที่เดียว
// (แทนการไล่ดูกลุ่ม LINE / เพจ / บอร์ดหน้าตึกทีละที่) แต่ละส่วนมีปุ่มไปทำต่อได้ทันที
// ลำดับ: หัวหน้า → การ์ดใหญ่ (เรื่องสำคัญที่สุดตอนนี้) → ประกาศ → ทางลัด → รายการ

import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ActivityRow, ActivityTile } from '@/components/activity-tile';
import { Text } from '@/components/app-text';
import { BroadcastList } from '@/components/broadcast-card';
import { HeroCard } from '@/components/hero-card';
import { HoursCard } from '@/components/hours-card';
import { TopBar } from '@/components/top-bar';
import { Button, Card, OfflineBanner, Screen, SectionHeader, StatPill, type IconName } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useRefreshControl } from '@/hooks/use-refresh-control';
import { summarizeAttendance } from '@/lib/attendance';
import { isEnded, newestFirst } from '@/lib/filter-activities';
import { formatDate, formatTime } from '@/lib/format';
import { useActivities } from '@/state/activities-context';
import { useBroadcasts } from '@/state/broadcasts-context';
import { useMyRegistrations } from '@/state/my-registrations-context';
import { useAuthenticatedSession } from '@/state/session-context';
import type { Activity } from '@/types/models';

const openActivity = (id: string) => router.push({ pathname: '/activities/[id]', params: { id } });
const CAMPUS = 'มข. วิทยาเขตหนองคาย';

export default function TodayScreen() {
  const session = useAuthenticatedSession();
  const activitiesState = useActivities();
  const broadcastsState = useBroadcasts();
  const registrationsState = useMyRegistrations();
  const refreshAll = useCallback(
    () => Promise.allSettled([activitiesState.refresh(), broadcastsState.refresh(), registrationsState.refresh()]),
    [activitiesState, broadcastsState, registrationsState],
  );
  const refreshControl = useRefreshControl(refreshAll);
  const upcoming = activitiesState.activities
    .filter((a) => !isEnded(a))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const today = formatDate(new Date().toISOString());
  const { broadcasts, offlineSince } = broadcastsState;

  if (!session) {
    return (
      <Screen refreshControl={refreshControl}>
        <TopBar eyebrow="KKUNK TODAY" title="สวัสดี" subtitle={`${today} · ${CAMPUS}`} />
        <HeroCard
          imageUrl={upcoming[0]?.imageUrl}
          tag={CAMPUS}
          eyebrow="CAMPUS LIFE"
          title={'ทุกเรื่องในมอ\nอยู่ในแอปเดียว'}
          subtitle="กิจกรรม จิตอาสา และประกาศจากเจ้าหน้าที่"
          onPress={() => router.navigate('/activities')}
          actionLabel="ดูกิจกรรมทั้งหมด">
          <StatPill tone="accent" icon="calendar" label={`${upcoming.length} กิจกรรมเปิดรับ`} />
        </HeroCard>
        <SectionHeader eyebrow="WHAT'S INSIDE" title="ทำอะไรได้บ้าง" />
        <View style={styles.tiles}>
          <Tile icon="calendar" label="กิจกรรม" text="ลงทะเบียน เช็กอิน สะสมชั่วโมง" />
          <Tile icon="heart" label="จิตอาสา" text="กิจกรรมจิตอาสา นับชั่วโมงให้" />
          <Tile icon="map" label="แผนที่" text="หาทาง นำทางไปกิจกรรม" />
          <Tile icon="megaphone" label="ประกาศ" text="ปิดน้ำ ปิดถนน รู้ก่อนใคร" />
        </View>
        <Button title="เข้าสู่ระบบ" icon="log-in-outline" onPress={() => router.push('/login')} />
        <Carousel eyebrow="UPCOMING" title="กิจกรรมที่กำลังจะมาถึง" activities={upcoming.slice(0, 6)} />
      </Screen>
    );
  }

  const { user } = session;
  const firstName = user.fullName.split(' ')[0];

  // เจ้าหน้าที่กิจกรรม: งานหลักอยู่ที่แท็บจัดการ หน้าแรกจึงเป็นทางลัด + ประกาศ + กิจกรรมที่กำลังมา
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
        <Announcements broadcasts={broadcasts} />
        <View style={styles.actions}>
          <QuickAction icon="clipboard" label="ตรวจหลักฐาน" onPress={() => router.navigate('/manage')} />
          <QuickAction icon="add-circle" label="สร้างกิจกรรม" onPress={() => router.push('/organizer/new')} />
          <QuickAction icon="megaphone" label="ส่งประกาศ" onPress={() => router.push('/broadcast/new')} />
        </View>
        <ActivityList eyebrow="UPCOMING" title="กิจกรรมที่กำลังจะมาถึง" activities={upcoming.slice(0, 5)} />
      </Screen>
    );
  }

  // ---------- นักศึกษา ----------
  const { registrations } = registrationsState;
  const myUpcoming = registrations
    .filter((r) => r.status === 'registered' || r.status === 'pending_review')
    .map((r) => ({ registration: r, activity: activitiesState.getById(r.activityId) }))
    .filter((x): x is { registration: typeof x.registration; activity: Activity } => !!x.activity && !isEnded(x.activity))
    .sort((a, b) => a.activity.startsAt.localeCompare(b.activity.startsAt));
  const summary = summarizeAttendance(registrations, activitiesState.activities);
  // แนะนำ: กิจกรรมที่เพิ่งโพสต์ใหม่ล่าสุดก่อน ในหมวดที่ผู้ใช้เลือกไว้ในโปรไฟล์ (ยังไม่เลือก = ทุกหมวด)
  // เฉพาะที่ยังไม่ได้ลงทะเบียน
  const notRegistered = upcoming.filter((a) => !myUpcoming.some((m) => m.activity.id === a.id));
  const interests = user.interests ?? [];
  const recommended = newestFirst(
    interests.length > 0 ? notRegistered.filter((a) => interests.includes(a.category)) : notRegistered,
  ).slice(0, 6);
  const others = notRegistered.filter((a) => !recommended.includes(a));
  const next = myUpcoming[0];
  const hoursPill = <StatPill tone="accent" icon="ribbon" label={`สะสม ${summary.hours} ชม.`} />;

  return (
    <Screen refreshControl={refreshControl}>
      <TopBar eyebrow="KKUNK TODAY · วันนี้ในมอ" title={`${greeting()}, ${firstName}`} subtitle={`${today} · ${CAMPUS}`} />

      {/* การ์ดใหญ่: มีกิจกรรมที่ลงไว้ → กิจกรรมถัดไป (แตะไปเช็กอิน) · ไม่มี → ชวนไปหากิจกรรม */}
      {next ? (
        <HeroCard
          imageUrl={next.activity.imageUrl}
          tag={next.activity.location.name}
          eyebrow="NEXT UP · กิจกรรมถัดไปของคุณ"
          title={next.activity.title}
          subtitle={`${formatDate(next.activity.startsAt)} · ${formatTime(next.activity.startsAt)}`}
          onPress={() => router.push({ pathname: '/registrations/[id]', params: { id: next.registration.id } })}
          actionLabel={`ดูการลงทะเบียน ${next.activity.title} และเช็กอิน`}>
          {hoursPill}
          <StatPill tone="dark" icon="ticket" label={`ลงไว้ ${myUpcoming.length}`} />
        </HeroCard>
      ) : (
        <HeroCard
          imageUrl={recommended[0]?.imageUrl ?? upcoming[0]?.imageUrl}
          tag={CAMPUS}
          eyebrow="DISCOVER"
          title={'ออกไปหา\nกิจกรรมดี ๆ วันนี้'}
          subtitle="ลงทะเบียน เข้าร่วม แล้วสะสมชั่วโมง"
          onPress={() => router.navigate('/activities')}
          actionLabel="ไปหากิจกรรม">
          {hoursPill}
          <StatPill tone="dark" icon="calendar" label={`${upcoming.length} กิจกรรมเปิดรับ`} />
        </HeroCard>
      )}

      <OfflineBanner since={offlineSince} />
      <Announcements broadcasts={broadcasts} />

      <View style={styles.actions}>
        <QuickAction icon="map" label="แผนที่" onPress={() => router.navigate('/map')} />
        <QuickAction icon="search" label="หากิจกรรม" onPress={() => router.navigate('/activities')} />
        <QuickAction icon="ticket" label="ลงไว้" onPress={() => router.push('/my')} />
        <QuickAction icon="star" label="บันทึกไว้" onPress={() => router.push('/saved')} />
      </View>

      {myUpcoming.length > 1 ? (
        <Card>
          <SectionHeader eyebrow="MY SCHEDULE" title="ที่ลงทะเบียนไว้" actionLabel="ดูทั้งหมด" onAction={() => router.push('/my')} />
          {myUpcoming.slice(1, 4).map(({ registration, activity }) => (
            <ActivityRow
              key={registration.id}
              activity={activity}
              accessibilityLabel={`${activity.title} ${formatDate(activity.startsAt)} ${formatTime(activity.startsAt)} แตะเพื่อดูและเช็กอิน`}
              onPress={() => router.push({ pathname: '/registrations/[id]', params: { id: registration.id } })}
            />
          ))}
        </Card>
      ) : null}

      <HoursCard summary={summary} />

      <Carousel
        eyebrow="NEW · ใหม่ล่าสุด"
        title={interests.length > 0 ? 'ใหม่ล่าสุดตามความสนใจ' : 'กิจกรรมใหม่ล่าสุด'}
        activities={recommended}
      />
      <ActivityList eyebrow="UPCOMING" title="กิจกรรมที่กำลังจะมาถึง" activities={others.slice(0, 3)} />
    </Screen>
  );
}

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? 'สวัสดีตอนเช้า' : hour < 17 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนเย็น';
}

function Announcements({ broadcasts }: { broadcasts: Parameters<typeof BroadcastList>[0]['items'] }) {
  if (broadcasts.length === 0) return null;
  return (
    <View style={{ gap: Spacing.md }}>
      <SectionHeader eyebrow="ANNOUNCEMENTS" title="ประกาศล่าสุด" />
      <BroadcastList items={broadcasts} />
    </View>
  );
}

function Carousel({ eyebrow, title, activities }: { eyebrow: string; title: string; activities: Activity[] }) {
  if (activities.length === 0) return null;
  return (
    <View style={{ gap: Spacing.md }}>
      <SectionHeader eyebrow={eyebrow} title={title} actionLabel="ดูทั้งหมด" onAction={() => router.navigate('/activities')} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
        {activities.map((a) => (
          <ActivityTile key={a.id} activity={a} onPress={() => openActivity(a.id)} />
        ))}
      </ScrollView>
    </View>
  );
}

function ActivityList({ eyebrow, title, activities }: { eyebrow: string; title: string; activities: Activity[] }) {
  if (activities.length === 0) return null;
  return (
    <Card>
      <SectionHeader eyebrow={eyebrow} title={title} actionLabel="ดูทั้งหมด" onAction={() => router.navigate('/activities')} />
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
      <View style={styles.quickIcon}>
        <Ionicons name={icon} size={22} color={Colors.primary} />
      </View>
      <Text style={styles.tileTitle}>{label}</Text>
      <Text style={styles.muted}>{text}</Text>
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
    padding: Spacing.lg,
    gap: 6,
  },
  tileTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  muted: { fontSize: 13, color: Colors.textMuted, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  quick: {
    flex: 1,
    minHeight: 84,
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
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickText: { fontSize: 12, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  carousel: { gap: Spacing.md, paddingRight: Spacing.lg },
});
