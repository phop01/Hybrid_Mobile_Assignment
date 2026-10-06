import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActivityMap } from '@/components/activity-map';
import { AnnouncementList } from '@/components/announcements';
import { NavigateButtons } from '@/components/navigate-buttons';
import { PosterImage } from '@/components/poster-image';
import { StatusBadge } from '@/components/status-badge';
import { Banner, Button, Card, CircleButton, InfoGrid, SectionHeader, StatPill, StateView } from '@/components/ui';
import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { firstParam, useActivity } from '@/hooks/use-activity';
import { useActivityAnnouncements } from '@/hooks/use-organizer';
import { CATEGORIES } from '@/lib/categories';
import { isEnded, seatsLeft } from '@/lib/filter-activities';
import { formatDateRange } from '@/lib/format';
import { toAbsoluteUrl } from '@/services/api-config';
import { useFavorites } from '@/state/favorites-context';
import { useMyRegistrations } from '@/state/my-registrations-context';
import { shareActivity } from '@/services/activity-actions';
import { useAuthenticatedSession } from '@/state/session-context';
import { Text } from '@/components/app-text';

export default function ActivityDetailScreen() {
  const id = firstParam(useLocalSearchParams<{ id?: string | string[] }>().id);
  const [reloadKey, setReloadKey] = useState(0);
  const state = useActivity(id, reloadKey);
  const session = useAuthenticatedSession();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { findActiveForActivity } = useMyRegistrations();
  const announcements = useActivityAnnouncements(id);
  const [notice, setNotice] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  if (state.status === 'loading') return <StateView kind="loading" message="กำลังโหลดรายละเอียด…" />;
  if (state.status === 'not_found') {
    // ID จากลิงก์หรือแจ้งเตือนอาจเป็นของกิจกรรมที่ถูกลบไปแล้ว
    return (
      <StateView
        kind="empty"
        icon="help-circle-outline"
        title="ไม่พบกิจกรรมนี้"
        message="กิจกรรมอาจถูกยกเลิกหรือลิงก์ไม่ถูกต้อง"
        actionLabel="ไปหน้ารายการกิจกรรม"
        onAction={() => router.replace('/')}
      />
    );
  }
  if (state.status === 'error') {
    return <StateView kind="error" title="โหลดไม่สำเร็จ" message={state.message} actionLabel="ลองใหม่" onAction={() => setReloadKey((k) => k + 1)} />;
  }

  const { activity, stale } = state;
  const category = CATEGORIES[activity.category];
  const registration = findActiveForActivity(activity.id);
  const ended = isEnded(activity);
  const left = seatsLeft(activity);
  const favorite = isFavorite(activity.id);

  const share = async () => {
    const result = await shareActivity(activity);
    setNotice(result === 'copied' ? 'คัดลอกข้อความกิจกรรมแล้ว วางส่งให้เพื่อนได้เลย' : result === 'failed' ? 'แชร์ไม่สำเร็จ ลองใหม่อีกครั้ง' : null);
  };

  const goRegister = () => {
    const target = `/activities/${activity.id}/register`;
    // ยังไม่ login → ไป login ก่อน แล้วกลับมาที่ฟอร์มลงทะเบียนต่อ
    if (!session) router.push({ pathname: '/login', params: { next: target } });
    else router.push({ pathname: '/activities/[id]/register', params: { id: activity.id } });
  };

  let action;
  if (session?.user.role === 'organizer') {
    // บัญชีผู้จัดไม่ลงทะเบียนเข้าร่วม แต่จัดการกิจกรรมของตัวเองได้
    action =
      activity.organizerId === session.user.id ? (
        <Button
          title="จัดการกิจกรรมนี้ (ผู้เข้าร่วม / ตรวจหลักฐาน)"
          icon="clipboard-outline"
          onPress={() => router.push({ pathname: '/organizer/[id]', params: { id: activity.id } })}
        />
      ) : (
        <Banner tone="info">บัญชีผู้จัดกิจกรรมดูรายละเอียดได้ แต่ลงทะเบียนเข้าร่วมไม่ได้</Banner>
      );
  } else if (registration) {
    action = (
      <View style={{ gap: Spacing.sm }}>
        <StatusBadge status={registration.status} />
        <Button
          title="ดูการลงทะเบียน / เช็กอิน"
          icon="ticket-outline"
          onPress={() => router.push({ pathname: '/registrations/[id]', params: { id: registration.id } })}
        />
      </View>
    );
  } else if (activity.cancelledAt) {
    action = (
      <View style={{ gap: Spacing.sm }}>
        <Banner tone="danger" icon="close-circle">
          กิจกรรมนี้ถูกยกเลิก: {activity.cancelReason}
        </Banner>
        <Button title="กิจกรรมถูกยกเลิก" disabled onPress={() => undefined} />
      </View>
    );
  } else if (ended) {
    action = <Button title="กิจกรรมจบแล้ว" disabled onPress={() => undefined} />;
  } else if (left === 0) {
    action = (
      <View style={{ gap: Spacing.sm }}>
        <Button title="เต็มแล้ว" disabled onPress={() => undefined} />
        <Text style={styles.muted}>กด ♡ บันทึกไว้ แล้วกลับมาดูอีกครั้ง อาจมีคนยกเลิก</Text>
      </View>
    );
  } else {
    action = <Button title={session ? 'ลงทะเบียน' : 'เข้าสู่ระบบเพื่อลงทะเบียน'} icon="create-outline" onPress={goRegister} />;
  }

  const seatValue = activity.cancelledAt
    ? 'ยกเลิกแล้ว'
    : ended
      ? 'กิจกรรมจบแล้ว'
      : left === 0
        ? `เต็มแล้ว (${activity.capacity} คน)`
        : `เหลือ ${left} จาก ${activity.capacity} ที่`;
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <>
      {/* หน้านี้วาดหัวเองบนรูป (ปุ่มกลับ/แชร์/บันทึกเป็นวงกลมลอย) */}
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}>
        {/* รูปปก 16:9 เท่าโปสเตอร์ เห็นเต็มใบไม่ถูกตัด (รูปสัดส่วนอื่นเติมขอบด้วยภาพเบลอ) · ปุ่มวงกลมลอยมุมบน */}
        <View style={[styles.hero, { paddingTop: insets.top }]}>
          {activity.imageUrl ? (
            <PosterImage
              uri={toAbsoluteUrl(activity.imageUrl)}
              style={StyleSheet.absoluteFill}
              accessibilityLabel={`รูปปกกิจกรรม ${activity.title}`}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.heroPlain, { backgroundColor: category.soft }]}>
              <Ionicons name={category.icon} size={150} color={category.color} style={{ opacity: 0.3 }} />
            </View>
          )}
          <View style={[styles.heroTop, { top: insets.top + Spacing.md }]}>
            <CircleButton icon="arrow-back" label="กลับ" onPress={back} />
            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
              <CircleButton icon="share-outline" label="แชร์กิจกรรมนี้" onPress={share} />
              <CircleButton
                icon={favorite ? 'heart' : 'heart-outline'}
                color={favorite ? Colors.heart : Colors.text}
                label={favorite ? 'นำออกจากที่บันทึกไว้' : 'บันทึกไว้ดูทีหลัง'}
                onPress={() => toggleFavorite(activity.id)}
              />
            </View>
          </View>
        </View>

        <View style={styles.sheet}>
          <View style={{ gap: Spacing.sm }}>
            <View style={[styles.category, { backgroundColor: category.soft }]}>
              <Ionicons name={category.icon} size={14} color={category.color} />
              <Text style={[styles.categoryText, { color: category.color }]}>{category.label}</Text>
            </View>
            <Text style={styles.title} accessibilityRole="header">
              {activity.title}
            </Text>
            <View style={styles.pills}>
              <StatPill icon="hourglass" label={`${activity.hours} ชั่วโมงกิจกรรม`} />
              <StatPill icon="people" label={`ลงแล้ว ${activity.registeredCount}/${activity.capacity} คน`} />
            </View>
          </View>

          {notice ? <Banner tone="info">{notice}</Banner> : null}
          {stale ? <Banner tone="warning">ออฟไลน์ · แสดงข้อมูลที่เก็บไว้ ที่นั่งคงเหลืออาจไม่ตรงกับปัจจุบัน</Banner> : null}

          {action}

          <Card>
            <SectionHeader eyebrow="DETAILS" title="ข้อมูลกิจกรรม" />
            <InfoGrid
              items={[
                { icon: 'time-outline', label: 'วันและเวลา', value: formatDateRange(activity.startsAt, activity.endsAt) },
                { icon: 'location-outline', label: 'สถานที่', value: activity.location.name },
                {
                  icon: 'people-outline',
                  label: 'ที่นั่ง',
                  value: seatValue,
                  color: activity.cancelledAt || (!ended && left === 0) ? Colors.danger : undefined,
                },
                { icon: 'person-outline', label: 'ผู้จัด', value: activity.organizerName },
                {
                  icon: activity.checkInMethod === 'paper' ? 'document-text-outline' : 'camera-outline',
                  label: 'หลักฐานการเข้าร่วม',
                  value:
                    activity.checkInMethod === 'paper'
                      ? 'ถ่ายรูปใบเซ็นชื่อส่งในแอป เจ้าหน้าที่ตรวจก่อนนับชั่วโมง'
                      : 'ถ่ายรูปที่งานส่งในแอป เจ้าหน้าที่ตรวจก่อนนับชั่วโมง',
                },
              ]}
            />
          </Card>

          {announcements.data.length > 0 ? (
            <Card>
              <SectionHeader eyebrow="UPDATES" title="ประกาศจากผู้จัด" />
              <AnnouncementList items={announcements.data} />
            </Card>
          ) : null}

          <Card>
            <SectionHeader eyebrow="ABOUT" title="รายละเอียด" />
            <Text style={styles.body}>{activity.description}</Text>
          </Card>

          <Card>
            <SectionHeader eyebrow="LOCATION" title="สถานที่จัดงาน" />
            <ActivityMap venue={activity.location} title={activity.title} />
            <Text style={styles.muted}>วงกลมคือบริเวณจัดงาน (รัศมี {activity.location.radiusM} ม.)</Text>
            <NavigateButtons place={activity.location} />
          </Card>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Colors.background },
  pageContent: { paddingBottom: Spacing.xxl },
  hero: { width: '100%', aspectRatio: 16 / 9, maxHeight: 460, backgroundColor: Colors.ink },
  heroPlain: { alignItems: 'flex-end', justifyContent: 'center', paddingRight: Spacing.lg },
  heroTop: { position: 'absolute', left: Spacing.lg, right: Spacing.lg, flexDirection: 'row', justifyContent: 'space-between' },
  category: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  categoryText: { fontSize: 12, fontWeight: '700' },
  title: { fontSize: 26, fontWeight: '800', color: Colors.text, lineHeight: 36 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  // แผ่นเนื้อหาซ้อนขึ้นไปบนรูปเล็กน้อย มุมบนโค้ง
  sheet: {
    marginTop: -Spacing.xl,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    backgroundColor: Colors.background,
    padding: Spacing.lg,
    paddingTop: Spacing.xl,
    gap: Spacing.lg,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  body: { fontSize: 15, color: Colors.text, lineHeight: 24 },
  muted: { fontSize: 13, color: Colors.textMuted, lineHeight: 18 },
});
