import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ActivityMap } from '@/components/activity-map';
import { AnnouncementList } from '@/components/announcements';
import { NavigateButtons } from '@/components/navigate-buttons';
import { StatusBadge } from '@/components/status-badge';
import { Banner, Button, Card, InfoRow, Screen, SectionTitle, StateView } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { firstParam, useActivity } from '@/hooks/use-activity';
import { useActivityAnnouncements } from '@/hooks/use-organizer';
import { CATEGORIES } from '@/lib/categories';
import { isEnded, seatsLeft } from '@/lib/filter-activities';
import { formatDateRange } from '@/lib/format';
import { toAbsoluteUrl } from '@/services/api-config';
import { useFavorites } from '@/state/favorites-context';
import { useMyRegistrations } from '@/state/my-registrations-context';
import { addToCalendar, shareActivity } from '@/services/activity-actions';
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
        onAction={() => router.replace('/activities')}
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

  const addCalendar = async () => {
    const result = await addToCalendar(activity);
    setNotice(result === 'failed' ? 'เพิ่มลงปฏิทินไม่สำเร็จ ลองใหม่อีกครั้ง' : null);
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
        <Text style={styles.muted}>กด ☆ บันทึกไว้ แล้วกลับมาดูอีกครั้ง อาจมีคนยกเลิก</Text>
      </View>
    );
  } else {
    action = <Button title={session ? 'ลงทะเบียน' : 'เข้าสู่ระบบเพื่อลงทะเบียน'} icon="create-outline" onPress={goRegister} />;
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons
                name="share-outline"
                size={24}
                color={Colors.textMuted}
                onPress={share}
                accessibilityLabel="แชร์กิจกรรมนี้"
                accessibilityRole="button"
                style={{ padding: 8 }}
              />
              <Ionicons
                name={favorite ? 'star' : 'star-outline'}
                size={24}
                color={favorite ? Colors.star : Colors.textMuted}
                onPress={() => toggleFavorite(activity.id)}
                accessibilityLabel={favorite ? 'นำออกจากที่บันทึกไว้' : 'บันทึกไว้ดูทีหลัง'}
                accessibilityRole="button"
                style={{ padding: 8 }}
              />
            </View>
          ),
        }}
      />
      <Screen>
        {notice ? <Banner tone="info">{notice}</Banner> : null}
        {stale ? <Banner tone="warning">ออฟไลน์ · แสดงข้อมูลที่เก็บไว้ ที่นั่งคงเหลืออาจไม่ตรงกับปัจจุบัน</Banner> : null}

        {activity.imageUrl ? (
          <Image
            source={{ uri: toAbsoluteUrl(activity.imageUrl) }}
            style={styles.cover}
            contentFit="cover"
            accessibilityLabel={`รูปปกกิจกรรม ${activity.title}`}
          />
        ) : null}

        <View style={{ gap: Spacing.sm }}>
          <View style={[styles.category, { backgroundColor: category.soft }]}>
            <Ionicons name={category.icon} size={14} color={category.color} />
            <Text style={[styles.categoryText, { color: category.color }]}>{category.label}</Text>
          </View>
          <Text style={styles.title} accessibilityRole="header">
            {activity.title}
          </Text>
        </View>

        <Card>
          <InfoRow icon="time-outline">{formatDateRange(activity.startsAt, activity.endsAt)}</InfoRow>
          <InfoRow icon="location-outline">{activity.location.name}</InfoRow>
          <InfoRow icon="hourglass-outline">
            ได้ {activity.hours} ชั่วโมงกิจกรรม · จัดโดย {activity.organizerName}
          </InfoRow>
          <InfoRow icon="people-outline">
            {ended ? 'กิจกรรมจบแล้ว' : `ลงทะเบียนแล้ว ${activity.registeredCount}/${activity.capacity} คน · เหลือ ${left} ที่`}
          </InfoRow>
          <InfoRow icon={activity.checkInMethod === 'paper' ? 'document-text-outline' : 'phone-portrait-outline'}>
            {activity.checkInMethod === 'paper'
              ? 'ใบเซ็นชื่อกระดาษ: เซ็นชื่อกับเจ้าหน้าที่แล้วถ่ายรูปใบเซ็นชื่อส่งในแอป เจ้าหน้าที่ตรวจก่อนนับชั่วโมง'
              : 'ถ่ายรูปที่งาน: ส่งรูปเป็นหลักฐานการเข้าร่วมในแอป เจ้าหน้าที่ตรวจก่อนนับชั่วโมง'}
          </InfoRow>
        </Card>

        {action}
        {!ended && !activity.cancelledAt ? (
          <Button title="เพิ่มลงปฏิทิน" icon="calendar-outline" variant="secondary" onPress={addCalendar} />
        ) : null}

        {announcements.data.length > 0 ? (
          <Card>
            <SectionTitle>ประกาศจากผู้จัด</SectionTitle>
            <AnnouncementList items={announcements.data} />
          </Card>
        ) : null}

        <Card>
          <SectionTitle>รายละเอียด</SectionTitle>
          <Text style={styles.body}>{activity.description}</Text>
        </Card>

        <Card>
          <SectionTitle>สถานที่</SectionTitle>
          <ActivityMap venue={activity.location} title={activity.title} />
          <Text style={styles.muted}>วงกลมคือบริเวณจัดงาน (รัศมี {activity.location.radiusM} ม.)</Text>
          <NavigateButtons place={activity.location} />
        </Card>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  category: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  categoryText: { fontSize: 13, fontWeight: '700' },
  cover: { width: '100%', aspectRatio: 16 / 9, borderRadius: Radius.lg, backgroundColor: Colors.border },
  title: { fontSize: 24, fontWeight: '800', color: Colors.text, lineHeight: 32 },
  body: { fontSize: 15, color: Colors.text, lineHeight: 24 },
  muted: { fontSize: 13, color: Colors.textMuted, lineHeight: 18 },
});
