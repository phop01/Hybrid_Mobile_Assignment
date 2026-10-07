import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { RefreshControl } from 'react-native';

import { EvidenceCard } from '@/components/evidence-card';
import { NavigateButtons } from '@/components/navigate-buttons';
import { ReminderControl } from '@/components/reminder-control';
import { StatusBadge } from '@/components/status-badge';
import { HeroCard } from '@/components/hero-card';
import { Banner, Button, Card, InfoGrid, InfoRow, Screen, SectionHeader, SectionTitle, StatPill, StateView } from '@/components/ui';
import { Colors } from '@/constants/theme';
import { firstParam } from '@/hooks/use-activity';
import { useNow } from '@/hooks/use-now';
import { formatDateRange } from '@/lib/format';
import { confirmAction } from '@/lib/platform-actions';
import { useActivities } from '@/state/activities-context';
import { useMyRegistrations } from '@/state/my-registrations-context';

export default function RegistrationDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[]; registered?: string }>();
  const id = firstParam(params.id);
  // มาจากฟอร์มลงทะเบียนที่เพิ่งส่งสำเร็จ
  const justRegistered = params.registered === '1';
  const { findById, loading, refresh, cancel, queuedIds } = useMyRegistrations();
  const { getById, status: activitiesStatus } = useActivities();
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const now = useNow();

  const registration = id ? findById(id) : undefined;
  const activity = registration ? getById(registration.activityId) : undefined;

  if (!registration || !activity) {
    if (loading || activitiesStatus === 'loading') return <StateView kind="loading" />;
    return (
      <StateView
        kind="empty"
        icon="help-circle-outline"
        title="ไม่พบการลงทะเบียนนี้"
        message="อาจถูกยกเลิกไปแล้ว หรือเป็นของบัญชีอื่น"
        actionLabel="ไปหน้าของฉัน"
        onAction={() => router.replace('/my')}
      />
    );
  }

  const queued = queuedIds.includes(registration.id);
  // กิจกรรมถูกยกเลิก = จบแล้ว (ไม่ให้ส่งหลักฐาน/ตั้งเตือน แม้ข้อมูลการลงทะเบียนในเครื่องยังเก่าอยู่)
  const ended = Boolean(activity.cancelledAt) || now > new Date(activity.endsAt).getTime();

  const onCancel = async () => {
    const ok = await confirmAction('ยกเลิกการลงทะเบียน', `ยกเลิก “${activity.title}” ใช่ไหม? ที่นั่งจะว่างให้คนอื่น`, 'ยกเลิกการลงทะเบียน');
    if (!ok) return;
    setCancelling(true);
    setError(null);
    try {
      await cancel(registration.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ยกเลิกไม่สำเร็จ');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <Screen refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={Colors.primary} />}>
      <HeroCard
        imageUrl={activity.imageUrl}
        eyebrow="MY REGISTRATION · การลงทะเบียนของฉัน"
        title={activity.title}
        onPress={() => router.push({ pathname: '/activities/[id]', params: { id: activity.id } })}
        actionLabel={`เปิดหน้ากิจกรรม ${activity.title}`}>
        <StatusBadge status={queued && registration.status === 'registered' ? 'queued' : registration.status} />
        <StatPill tone="dark" icon="hourglass" label={`${activity.hours} ชม.`} />
      </HeroCard>

      {justRegistered ? <Banner tone="success">ลงทะเบียน “{activity.title}” สำเร็จ</Banner> : null}

      {/* เพิ่งลงทะเบียน → เลือก "เตือนฉันอีกที" ไว้ก่อน */}
      {registration.status === 'registered' && !queued && !ended ? (
        <Card>
          <SectionHeader eyebrow="REMINDER" title="เตือนให้ไปเช็กอิน" />
          <ReminderControl registrationId={registration.id} activity={activity} now={now} preferCountdown={justRegistered} />
        </Card>
      ) : null}

      <Card>
        <SectionHeader eyebrow="WHEN & WHERE" title="เวลาและสถานที่" />
        <InfoGrid
          items={[
            { icon: 'time-outline', label: 'วันและเวลา', value: formatDateRange(activity.startsAt, activity.endsAt) },
            { icon: 'location-outline', label: 'สถานที่', value: activity.location.name },
          ]}
        />
        <NavigateButtons place={activity.location} />
      </Card>

      <EvidenceCard registration={registration} activity={activity} />

      <Card>
        <SectionTitle>ข้อมูลที่ลงทะเบียน</SectionTitle>
        <InfoRow icon="person-outline">
          {registration.form.fullName} ({registration.form.studentId})
        </InfoRow>
        <InfoRow icon="school-outline">{registration.form.faculty}</InfoRow>
        <InfoRow icon="call-outline">{registration.form.phone}</InfoRow>
        {registration.form.dietary ? <InfoRow icon="restaurant-outline">{registration.form.dietary}</InfoRow> : null}
      </Card>

      {error ? <Banner tone="danger">{error}</Banner> : null}
      {registration.status === 'registered' && !queued && !ended ? (
        <Button title="ยกเลิกการลงทะเบียน" icon="close-circle-outline" variant="danger" loading={cancelling} onPress={onCancel} />
      ) : null}
      <Button
        title="ดูรายละเอียดกิจกรรม"
        variant="ghost"
        onPress={() => router.push({ pathname: '/activities/[id]', params: { id: activity.id } })}
      />
    </Screen>
  );
}

