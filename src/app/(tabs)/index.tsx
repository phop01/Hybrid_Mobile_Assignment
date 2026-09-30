// หน้าแรก "วันนี้ในมอ": เปิดแอปแล้วเห็นทุกเรื่องที่เกี่ยวกับตัวเองวันนี้ในที่เดียว
// (แทนการไล่ดูกลุ่ม LINE / เพจ / บอร์ดหน้าตึกทีละที่) แต่ละส่วนมีปุ่มไปทำต่อได้ทันที

import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BroadcastList } from '@/components/broadcast-card';
import { TicketCard } from '@/components/ticket-card';
import { Button, Card, OfflineBanner, Screen, SectionTitle, type IconName } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useRefreshControl } from '@/hooks/use-refresh-control';
import { REQUIRED_HOURS, summarizeAttendance } from '@/lib/attendance';
import { CATEGORIES } from '@/lib/categories';
import { isEnded } from '@/lib/filter-activities';
import { formatDate, formatTime } from '@/lib/format';
import { isActive, isFacilities, sortByUrgency } from '@/lib/tickets';
import { useActivities } from '@/state/activities-context';
import { useMyRegistrations } from '@/state/my-registrations-context';
import { useAuthenticatedSession } from '@/state/session-context';
import { useTickets } from '@/state/tickets-context';
import type { Activity } from '@/types/models';

const openTicket = (id: string) => router.push({ pathname: '/tickets/[id]', params: { id } });
const openActivity = (id: string) => router.push({ pathname: '/activities/[id]', params: { id } });

export default function TodayScreen() {
  const session = useAuthenticatedSession();
  const activitiesState = useActivities();
  const ticketsState = useTickets();
  const registrationsState = useMyRegistrations();
  const refreshAll = useCallback(
    () => Promise.allSettled([activitiesState.refresh(), ticketsState.refresh(), registrationsState.refresh()]),
    [activitiesState, registrationsState, ticketsState],
  );
  const refreshControl = useRefreshControl(refreshAll);
  const upcoming = activitiesState.activities
    .filter((a) => !isEnded(a))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  if (!session) {
    return (
      <Screen refreshControl={refreshControl}>
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>ทุกเรื่องในมอ อยู่ในแอปเดียว</Text>
          <Text style={styles.heroText}>มข. วิทยาเขตหนองคาย · กิจกรรม จิตอาสา แจ้งซ่อม และประกาศจากเจ้าหน้าที่</Text>
        </View>
        <View style={styles.tiles}>
          <Tile icon="calendar" label="กิจกรรม" text="ลงทะเบียน เช็กอิน สะสมชั่วโมง" />
          <Tile icon="heart" label="จิตอาสา" text="กิจกรรมจิตอาสา นับชั่วโมงให้" />
          <Tile icon="construct" label="แจ้งซ่อม" text="ถ่ายรูป ปักหมุด ติดตามได้" />
          <Tile icon="megaphone" label="ประกาศ" text="ปิดน้ำ ปิดถนน รู้ก่อนใคร" />
        </View>
        <Button title="เข้าสู่ระบบ" icon="log-in-outline" onPress={() => router.push('/login')} />
        <UpcomingActivities activities={upcoming.slice(0, 3)} />
      </Screen>
    );
  }

  const { user } = session;
  const { tickets, broadcasts, offlineSince } = ticketsState;

  // เจ้าหน้าที่กิจกรรม: งานหลักอยู่ที่แท็บจัดการ หน้าแรกจึงเป็นทางลัด + ประกาศ + กิจกรรมที่กำลังมา
  if (user.role === 'organizer' && !isFacilities(user)) {
    return (
      <Screen refreshControl={refreshControl}>
        <Greeting name={user.fullName} />
        <OfflineBanner since={offlineSince} />
        <BroadcastList items={broadcasts} />
        <View style={styles.actions}>
          <QuickAction icon="clipboard" label="จัดการ / ตรวจหลักฐาน" onPress={() => router.navigate('/manage')} />
          <QuickAction icon="add-circle" label="สร้างกิจกรรม" onPress={() => router.push('/organizer/new')} />
          <QuickAction icon="megaphone" label="ส่งประกาศ" onPress={() => router.push('/broadcast/new')} />
          <QuickAction icon="construct" label="แจ้งซ่อม" onPress={() => router.push('/tickets/new')} />
        </View>
        <UpcomingActivities activities={upcoming.slice(0, 5)} />
      </Screen>
    );
  }

  if (user.role === 'organizer') {
    const openRepairs = sortByUrgency(tickets.filter((t) => t.kind === 'repair' && t.status === 'open'));
    const myJobs = tickets.filter((t) => t.assigneeId === user.id && isActive(t));
    const appointments = myJobs
      .filter((t) => t.appointmentAt && t.status === 'accepted')
      .sort((a, b) => (a.appointmentAt ?? '').localeCompare(b.appointmentAt ?? ''));
    return (
      <Screen refreshControl={refreshControl}>
        <Greeting name={user.fullName} />
        <OfflineBanner since={offlineSince} />
        <View style={styles.stats}>
          <Stat value={openRepairs.length} label="เรื่องรอรับ" onPress={() => router.navigate('/tickets')} />
          <Stat value={myJobs.length} label="งานของฉัน" onPress={() => router.navigate('/tickets')} />
          <Stat value={broadcasts.length} label="ประกาศที่ใช้อยู่" />
        </View>
        <BroadcastList items={broadcasts} />
        <Button title="ส่งประกาศถึงทุกคน" icon="megaphone" variant="secondary" onPress={() => router.push('/broadcast/new')} />
        {appointments.length > 0 ? (
          <Card>
            <SectionTitle>นัดซ่อมของฉัน</SectionTitle>
            {appointments.map((t) => (
              <Pressable key={t.id} style={styles.listRow} onPress={() => openTicket(t.id)} accessibilityRole="button">
                <Ionicons name="calendar" size={18} color={Colors.primary} />
                <Text style={styles.listText}>
                  {formatDate(t.appointmentAt!)} {formatTime(t.appointmentAt!)} · {t.title}
                </Text>
              </Pressable>
            ))}
          </Card>
        ) : null}
        <SectionTitle>เร่งด่วนที่สุดตอนนี้</SectionTitle>
        {openRepairs.length === 0 ? (
          <Text style={styles.muted}>ไม่มีเรื่องแจ้งซ่อมรอรับ 🎉</Text>
        ) : (
          openRepairs.slice(0, 3).map((t) => <TicketCard key={t.id} ticket={t} onOpen={openTicket} />)
        )}
      </Screen>
    );
  }

  // ---------- นักศึกษา ----------
  const { registrations } = registrationsState;
  const needConfirm = tickets.filter((t) => t.reporterId === user.id && t.status === 'done');
  const myOpen = tickets.filter((t) => t.reporterId === user.id && (t.status === 'open' || t.status === 'accepted'));
  const myUpcoming = registrations
    .filter((r) => r.status === 'registered' || r.status === 'pending_review')
    .map((r) => ({ registration: r, activity: activitiesState.getById(r.activityId) }))
    .filter((x): x is { registration: typeof x.registration; activity: Activity } => !!x.activity && !isEnded(x.activity))
    .sort((a, b) => a.activity.startsAt.localeCompare(b.activity.startsAt));
  const summary = summarizeAttendance(registrations, activitiesState.activities);

  return (
    <Screen refreshControl={refreshControl}>
      <Greeting name={user.fullName} />
      <OfflineBanner since={offlineSince} />
      <BroadcastList items={broadcasts} />

      <View style={styles.actions}>
        <QuickAction icon="construct" label="แจ้งซ่อม" onPress={() => router.push('/tickets/new')} />
        <QuickAction icon="map" label="แผนที่" onPress={() => router.navigate('/map')} />
        <QuickAction icon="calendar" label="หากิจกรรม" onPress={() => router.navigate('/activities')} />
        <QuickAction icon="ticket" label="ที่ลงทะเบียน" onPress={() => router.push('/my')} />
      </View>

      {needConfirm.length > 0 ? (
        <Card style={styles.attention}>
          <SectionTitle>รอคุณยืนยัน</SectionTitle>
          <Text style={styles.muted}>เจ้าหน้าที่บอกว่าซ่อมเสร็จแล้ว ตรวจแล้วกดยืนยัน หรือบอกว่ายังไม่เรียบร้อย</Text>
          {needConfirm.map((t) => (
            <TicketCard key={t.id} ticket={t} onOpen={openTicket} />
          ))}
        </Card>
      ) : null}

      {myUpcoming.length > 0 ? (
        <Card>
          <SectionTitle>กิจกรรมที่ลงทะเบียนไว้</SectionTitle>
          {myUpcoming.slice(0, 3).map(({ registration, activity }) => (
            <Pressable
              key={registration.id}
              style={styles.listRow}
              accessibilityRole="button"
              accessibilityLabel={`${activity.title} ${formatDate(activity.startsAt)} ${formatTime(activity.startsAt)} แตะเพื่อดูและเช็กอิน`}
              onPress={() => router.push({ pathname: '/registrations/[id]', params: { id: registration.id } })}>
              <View style={[styles.dot, { backgroundColor: CATEGORIES[activity.category].color }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.listTitle} numberOfLines={1}>
                  {activity.title}
                </Text>
                <Text style={styles.muted}>
                  {formatDate(activity.startsAt)} · {formatTime(activity.startsAt)} · {activity.location.name}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </Pressable>
          ))}
        </Card>
      ) : null}

      {myOpen.length > 0 ? (
        <>
          <SectionTitle>เรื่องที่ฉันแจ้ง</SectionTitle>
          {myOpen.slice(0, 3).map((t) => (
            <TicketCard key={t.id} ticket={t} onOpen={openTicket} />
          ))}
        </>
      ) : null}

      <Pressable
        style={styles.hours}
        onPress={() => router.navigate('/profile')}
        accessibilityRole="button"
        accessibilityLabel={`ชั่วโมงสะสม ${summary.hours} จาก ${REQUIRED_HOURS} ชั่วโมง แตะเพื่อดูรายละเอียด`}>
        <Ionicons name="ribbon" size={24} color={Colors.onPrimary} />
        <Text style={styles.hoursText}>
          ชั่วโมงกิจกรรมสะสม {summary.hours}/{REQUIRED_HOURS} ชม.
        </Text>
        <Ionicons name="chevron-forward" size={18} color={Colors.onPrimaryMuted} />
      </Pressable>

      <UpcomingActivities activities={upcoming.filter((a) => !myUpcoming.some((m) => m.activity.id === a.id)).slice(0, 3)} />
    </Screen>
  );
}

function Greeting({ name }: { name: string }) {
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'สวัสดีตอนเช้า' : hour < 17 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนเย็น';
  return (
    <View style={{ gap: 2 }}>
      <Text style={styles.greet}>
        {greet}, {name.split(' ')[0]}
      </Text>
      <Text style={styles.muted}>{formatDate(new Date().toISOString())} · มข. วิทยาเขตหนองคาย</Text>
    </View>
  );
}

function UpcomingActivities({ activities }: { activities: Activity[] }) {
  if (activities.length === 0) return null;
  return (
    <Card>
      <SectionTitle>กิจกรรมที่กำลังจะมาถึง</SectionTitle>
      {activities.map((a) => (
        <Pressable
          key={a.id}
          style={styles.listRow}
          onPress={() => openActivity(a.id)}
          accessibilityRole="button"
          accessibilityLabel={`${a.title} ${CATEGORIES[a.category].label} ${formatDate(a.startsAt)}`}>
          <View style={[styles.dot, { backgroundColor: CATEGORIES[a.category].color }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.listTitle} numberOfLines={1}>
              {a.title}
            </Text>
            <Text style={styles.muted}>
              {CATEGORIES[a.category].label} · {formatDate(a.startsAt)} {formatTime(a.startsAt)}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
        </Pressable>
      ))}
      <Button title="ดูกิจกรรมทั้งหมด" variant="ghost" onPress={() => router.navigate('/activities')} />
    </Card>
  );
}

function QuickAction({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.quick, pressed && { opacity: 0.8 }]} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <Ionicons name={icon} size={26} color={Colors.primary} />
      <Text style={styles.quickText}>{label}</Text>
    </Pressable>
  );
}

function Tile({ icon, label, text }: { icon: IconName; label: string; text: string }) {
  return (
    <View style={styles.tile}>
      <Ionicons name={icon} size={24} color={Colors.primary} />
      <Text style={styles.listTitle}>{label}</Text>
      <Text style={styles.muted}>{text}</Text>
    </View>
  );
}

function Stat({ value, label, onPress }: { value: number; label: string; onPress?: () => void }) {
  return (
    <Pressable style={styles.stat} onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : 'text'} accessibilityLabel={`${label} ${value}`}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.muted}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: Colors.primary, borderRadius: Radius.lg, padding: Spacing.xl, gap: Spacing.sm },
  heroTitle: { fontSize: 24, fontWeight: '800', color: Colors.onPrimary },
  heroText: { fontSize: 15, color: Colors.onPrimaryMuted, lineHeight: 22 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  tile: {
    flexGrow: 1,
    flexBasis: 150,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: 4,
  },
  greet: { fontSize: 22, fontWeight: '800', color: Colors.text },
  muted: { fontSize: 13, color: Colors.textMuted, lineHeight: 18 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  quick: {
    flexGrow: 1,
    flexBasis: 72,
    minHeight: 76,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
  },
  quickText: { fontSize: 13, fontWeight: '600', color: Colors.text, textAlign: 'center' },
  attention: { borderColor: Colors.warning, backgroundColor: Colors.warningSoft },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: 48 },
  listTitle: { fontSize: 15, fontWeight: '600', color: Colors.text },
  listText: { flex: 1, fontSize: 14, color: Colors.text },
  dot: { width: 10, height: 10, borderRadius: 5 },
  hours: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  hoursText: { flex: 1, color: Colors.onPrimary, fontSize: 16, fontWeight: '700' },
  stats: { flexDirection: 'row', gap: Spacing.sm },
  stat: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  statValue: { fontSize: 28, fontWeight: '800', color: Colors.primary },
});
