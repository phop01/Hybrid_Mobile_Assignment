import { router } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, SectionList, StyleSheet, View } from 'react-native';

import { ActivityCard } from '@/components/activity-card';
import { LoginPrompt } from '@/components/login-prompt';
import type { DisplayStatus } from '@/components/status-badge';
import { WeekStrip } from '@/components/week-strip';
import { Banner, OfflineBanner, StatPill, StateView } from '@/components/ui';
import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { isEnded } from '@/lib/filter-activities';
import { countByDay, dayKey } from '@/lib/week-strip';
import { useActivities } from '@/state/activities-context';
import { useFavorites } from '@/state/favorites-context';
import { useMyRegistrations } from '@/state/my-registrations-context';
import { useAuthenticatedSession } from '@/state/session-context';
import type { Activity, Registration } from '@/types/models';
import { Text } from '@/components/app-text';

type Row = { registration: Registration; activity: Activity; status: DisplayStatus };

/**
 * การลงทะเบียนของฉัน เปิดดูได้แม้ไม่มีเน็ต (อ่านจาก SQLite ในเครื่อง)
 * เหตุผล: ในห้องประชุม/หอประชุมสัญญาณมักไม่ดี แต่ต้องเปิดดูและเช็กอินได้
 */
export default function MyScreen() {
  const session = useAuthenticatedSession();
  const { registrations, loading, offlineSince, error, queuedIds, refresh } = useMyRegistrations();
  const { getById } = useActivities();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [day, setDay] = useState<string | null>(null);

  if (!session) {
    return (
      <LoginPrompt
        icon="ticket-outline"
        title="ดูกิจกรรมที่ลงทะเบียนไว้"
        message="เข้าสู่ระบบเพื่อดูการลงทะเบียน เช็กอิน และประวัติการเข้าร่วม"
        next="/my"
      />
    );
  }

  const rows: Row[] = registrations.flatMap((registration) => {
    const activity = getById(registration.activityId);
    if (!activity) return [];
    const status: DisplayStatus =
      registration.status === 'registered' && queuedIds.includes(registration.id) ? 'queued' : registration.status;
    return [{ registration, activity, status }];
  });

  const upcoming = rows
    .filter((r) => ['registered', 'queued', 'pending_review'].includes(r.status) && !isEnded(r.activity))
    .sort((a, b) => a.activity.startsAt.localeCompare(b.activity.startsAt));
  const attended = rows.filter((r) => r.status === 'checked_in');
  const past = rows.filter((r) => !upcoming.includes(r) && !attended.includes(r));

  // แตะวันในแถบ 7 วัน → แสดงเฉพาะกิจกรรมที่กำลังจะถึงของวันนั้น
  const shownUpcoming = day ? upcoming.filter((r) => dayKey(new Date(r.activity.startsAt)) === day) : upcoming;

  const sections = [
    { title: day ? 'กิจกรรมของวันที่เลือก' : 'กำลังจะถึง', data: shownUpcoming },
    { title: 'เข้าร่วมแล้ว', data: day ? [] : attended },
    { title: 'ยกเลิก / ไม่ได้เข้าร่วม', data: day ? [] : past },
  ].filter((s) => s.data.length > 0);

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => item.registration.id}
      style={{ backgroundColor: Colors.background }}
      contentContainerStyle={styles.list}
      stickySectionHeadersEnabled={false}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={Colors.primary} />}
      ListHeaderComponent={
        <View style={{ gap: Spacing.md }}>
          {/* สรุปตัวเลขด้านบน: กำลังจะถึง · เข้าร่วมแล้ว · รอตรวจ */}
          <View style={styles.summary}>
            <Text style={styles.eyebrow}>MY ACTIVITIES · ที่ลงทะเบียนไว้</Text>
            <Text style={styles.summaryTitle}>
              {upcoming.length} <Text style={styles.summaryUnit}>กิจกรรมที่กำลังจะถึง</Text>
            </Text>
            <View style={styles.pills}>
              <StatPill tone="accent" icon="checkmark-circle" label={`เข้าร่วมแล้ว ${attended.length}`} />
              <StatPill tone="dark" icon="hourglass" label={`รอตรวจ ${rows.filter((r) => r.status === 'pending_review').length}`} />
            </View>
          </View>
          <OfflineBanner since={offlineSince} />
          {upcoming.length > 0 ? (
            <WeekStrip counts={countByDay(upcoming.map((r) => r.activity))} selected={day} onSelect={setDay} />
          ) : null}
          {day && shownUpcoming.length === 0 ? <Banner tone="info">วันนี้ที่เลือกยังไม่มีกิจกรรมที่ลงทะเบียนไว้</Banner> : null}
          {queuedIds.length > 0 ? (
            <Banner tone="warning" icon="cloud-upload">
              มีเช็กอิน {queuedIds.length} รายการรอส่ง จะส่งให้อัตโนมัติเมื่อกลับมาออนไลน์
            </Banner>
          ) : null}
          {error ? <Banner tone="danger">{error}</Banner> : null}
        </View>
      }
      renderSectionHeader={({ section }) => (
        <Text style={styles.sectionTitle} accessibilityRole="header">
          {section.title} ({section.data.length})
        </Text>
      )}
      renderItem={({ item }) => (
        <ActivityCard
          activity={item.activity}
          status={item.status}
          isFavorite={isFavorite(item.activity.id)}
          onToggleFavorite={toggleFavorite}
          onOpen={() => router.push({ pathname: '/registrations/[id]', params: { id: item.registration.id } })}
        />
      )}
      ListEmptyComponent={
        loading ? (
          <StateView kind="loading" />
        ) : (
          <StateView
            kind="empty"
            icon="ticket-outline"
            title="ยังไม่ได้ลงทะเบียนกิจกรรม"
            message="เลือกกิจกรรมที่สนใจแล้วกดลงทะเบียน"
            actionLabel="ไปดูกิจกรรม"
            onAction={() => router.navigate('/activities')}
          />
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: Spacing.lg, gap: Spacing.md, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  sectionTitle: { fontSize: 13, fontWeight: '800', letterSpacing: 0.4, color: Colors.textMuted, marginTop: Spacing.sm },
  summary: { backgroundColor: Colors.ink, borderRadius: Radius.xxl, padding: Spacing.xl, gap: Spacing.sm },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.6, color: Colors.highlight },
  summaryTitle: { fontSize: 40, fontWeight: '800', color: Colors.onPrimary },
  summaryUnit: { fontSize: 16, fontWeight: '600', color: Colors.onPrimaryMuted },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
});
