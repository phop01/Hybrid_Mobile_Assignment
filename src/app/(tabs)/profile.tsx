import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { RoleSwitcher } from '@/components/role-switcher';
import { LoginPrompt } from '@/components/login-prompt';
import { Banner, Button, Card, Screen, SectionTitle } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { REQUIRED_HOURS, summarizeAttendance } from '@/lib/attendance';
import { CATEGORIES, CATEGORY_ORDER } from '@/lib/categories';
import { formatDate } from '@/lib/format';
import { confirmAction } from '@/lib/platform-actions';
import { isFacilities } from '@/lib/tickets';
import { API_URL, toAbsoluteUrl } from '@/services/api-config';
import { useActivities } from '@/state/activities-context';
import { useMyRegistrations } from '@/state/my-registrations-context';
import { useAuthenticatedSession, useSession } from '@/state/session-context';

export default function ProfileScreen() {
  const session = useAuthenticatedSession();
  const { signOut } = useSession();
  const { registrations } = useMyRegistrations();
  const { activities, getById } = useActivities();

  if (!session) {
    return (
      <LoginPrompt
        icon="person-circle-outline"
        title="โปรไฟล์และชั่วโมงสะสม"
        message="เข้าสู่ระบบเพื่อดูชั่วโมงกิจกรรม/จิตอาสา เรื่องที่แจ้ง และหลักฐานการเข้าร่วม"
        next="/profile"
      />
    );
  }

  const { user } = session;
  const isOrganizer = user.role === 'organizer';
  // ชั่วโมงมาจากการเข้าร่วมกิจกรรมเท่านั้น (จิตอาสาคือกิจกรรมหมวดจิตอาสา)
  const summary = summarizeAttendance(registrations, activities);
  const maxHours = Math.max(1, ...CATEGORY_ORDER.map((c) => summary.hoursByCategory[c]));
  // ประวัติกิจกรรมที่ได้ชั่วโมงแล้ว ใหม่สุดก่อน ใช้ทำพอร์ต/ยื่นชั่วโมงกิจกรรม
  const history = registrations
    .filter((r) => r.status === 'checked_in')
    .map((r) => ({ registration: r, activity: getById(r.activityId) }))
    .filter((x) => x.activity)
    .sort((a, b) => b.activity!.startsAt.localeCompare(a.activity!.startsAt));

  // แกลเลอรีหลักฐาน: รวมรูปเช็กอินทุกกิจกรรม ใช้ยื่นหลักฐาน (เช่น ชั่วโมงจิตอาสา กยศ.) หรือทำพอร์ตได้
  const evidence = registrations
    .filter((r) => r.checkIn && (r.status === 'checked_in' || r.status === 'pending_review'))
    .sort((a, b) => (b.checkIn?.takenAt ?? '').localeCompare(a.checkIn?.takenAt ?? ''));

  const onSignOut = async () => {
    const ok = await confirmAction(
      'ออกจากระบบ',
      'ข้อมูลที่เก็บในเครื่อง (การลงทะเบียน เรื่องที่รอส่ง กล่องแจ้งเตือน) และการแจ้งเตือนที่ตั้งไว้จะถูกลบ',
      'ออกจากระบบ',
    );
    if (ok) await signOut();
  };

  return (
    <Screen>
      <RoleSwitcher />
      <Card style={styles.identity}>
        {/* ตัวอักษรในวงกลมเป็นของตกแต่ง: ซ่อนจาก screen reader และจำกัดการขยายไม่ให้ล้นวงกลม */}
        <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Text style={styles.avatarText} maxFontSizeMultiplier={1.3}>
            {user.fullName.slice(0, 1)}
          </Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.name}>{user.fullName}</Text>
          <Text style={styles.muted}>
            {isOrganizer ? 'เจ้าหน้าที่ · รหัสบุคลากร' : 'รหัสนักศึกษา'} {user.studentId}
          </Text>
          <Text style={styles.muted}>{user.faculty}</Text>
        </View>
      </Card>

      {isOrganizer ? (
        <Card>
          <SectionTitle>{isFacilities(user) ? 'เจ้าหน้าที่งานอาคารสถานที่' : 'เจ้าหน้าที่งานกิจกรรมนักศึกษา'}</SectionTitle>
          <Text style={styles.muted}>
            {isFacilities(user)
              ? 'รับเรื่องแจ้งซ่อม นัดเวลา และปิดงานที่แท็บ “เรื่องแจ้ง” · ส่งประกาศ (ปิดน้ำ ปิดถนน) จากหน้า “วันนี้”'
              : 'สร้างกิจกรรมและตรวจหลักฐานใบเซ็นชื่อที่แท็บ “จัดการ” · ส่งประกาศจากหน้า “วันนี้” · แจ้งซ่อมได้เหมือนคนทั่วไป'}
          </Text>
          {isFacilities(user) ? (
            <Button title="ไปคิวงานแจ้งซ่อม" icon="construct-outline" onPress={() => router.navigate('/tickets')} />
          ) : (
            <Button title="ไปหน้าจัดการ" icon="clipboard-outline" onPress={() => router.push('/manage')} />
          )}
        </Card>
      ) : (
        <>
          <Card>
            <SectionTitle>ชั่วโมงกิจกรรม</SectionTitle>
            <View style={styles.hoursHero}>
              <View
                style={styles.totalRow}
                accessible
                accessibilityLabel={`สะสม ${summary.hours} จาก ${REQUIRED_HOURS} ชั่วโมง จาก ${summary.total} กิจกรรม`}>
                <Text style={styles.total}>{summary.hours}</Text>
                <Text style={styles.totalLabel}>/ {REQUIRED_HOURS} ชั่วโมง</Text>
              </View>
              <View
                style={styles.progressTrack}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants">
                <View style={[styles.progressFill, { width: `${summary.progress * 100}%` }]} />
              </View>
              <Text style={styles.heroText}>
                จาก {summary.total} กิจกรรม ·{' '}
                {summary.hours >= REQUIRED_HOURS
                  ? 'ครบตามเป้าหมายแล้ว 🎉'
                  : `อีก ${REQUIRED_HOURS - summary.hours} ชั่วโมงจะครบเป้าหมาย`}
              </Text>
            </View>
            {summary.pendingReview > 0 ? (
              <Banner tone="warning" icon="hourglass">
                มีหลักฐาน {summary.pendingReview} รายการ ({summary.pendingHours} ชม.) รอผู้จัดตรวจ จะนับเมื่อตรวจผ่าน
              </Banner>
            ) : null}

            <View style={{ gap: Spacing.sm }}>
              {CATEGORY_ORDER.map((c) => {
                const hours = summary.hoursByCategory[c];
                return (
                  <View
                    key={c}
                    style={styles.barRow}
                    accessible
                    accessibilityLabel={`${CATEGORIES[c].label} ${hours} ชั่วโมง ${summary.byCategory[c]} กิจกรรม`}>
                    <Text style={styles.barLabel}>{CATEGORIES[c].label}</Text>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          { width: `${(hours / maxHours) * 100}%`, backgroundColor: CATEGORIES[c].color },
                        ]}
                      />
                    </View>
                    <Text style={styles.barCount}>{hours} ชม.</Text>
                  </View>
                );
              })}
            </View>
          </Card>

          <Card>
            <SectionTitle>ประวัติกิจกรรมที่ได้ชั่วโมง</SectionTitle>
            {history.length === 0 ? (
              <Text style={styles.muted}>ยังไม่มี เมื่อเช็กอินสำเร็จหรือหลักฐานผ่าน กิจกรรมจะมาอยู่ที่นี่</Text>
            ) : (
              history.map(({ registration, activity }) => (
                <Pressable
                  key={registration.id}
                  style={styles.historyRow}
                  accessibilityRole="button"
                  accessibilityLabel={`${activity!.title}, ${formatDate(activity!.startsAt)}, ${activity!.hours} ชั่วโมง`}
                  onPress={() => router.push({ pathname: '/registrations/[id]', params: { id: registration.id } })}>
                  <View style={[styles.historyDot, { backgroundColor: CATEGORIES[activity!.category].color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.historyTitle} numberOfLines={2}>
                      {activity!.title}
                    </Text>
                    <Text style={styles.muted}>{formatDate(activity!.startsAt)}</Text>
                  </View>
                  <Text style={styles.historyHours}>+{activity!.hours} ชม.</Text>
                </Pressable>
              ))
            )}
          </Card>
        </>
      )}

      {isOrganizer ? null : (
        <Card>
          <SectionTitle>หลักฐานการเข้าร่วม</SectionTitle>
          {evidence.length === 0 ? (
            <Text style={styles.muted}>ยังไม่มีรูปหลักฐาน รูปจากการเช็กอินจะมาอยู่ที่นี่</Text>
          ) : (
            <View style={styles.gallery}>
              {evidence.map((r) => (
                <Pressable
                  key={r.id}
                  style={styles.photoCell}
                  accessibilityRole="button"
                  accessibilityLabel={`หลักฐาน ${getById(r.activityId)?.title ?? ''}`}
                  onPress={() => router.push({ pathname: '/registrations/[id]', params: { id: r.id } })}>
                  <Image source={{ uri: toAbsoluteUrl(r.checkIn!.photoUrl) }} style={styles.photo} contentFit="cover" />
                  <Text numberOfLines={2} style={styles.photoTitle}>
                    {getById(r.activityId)?.title ?? 'กิจกรรม'}
                  </Text>
                  <Text style={styles.photoDate}>
                    {formatDate(r.checkIn!.takenAt)}
                    {r.status === 'pending_review' ? ' · รอตรวจ' : ''}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </Card>
      )}

      <Card>
        <SectionTitle>ทางลัด</SectionTitle>
        {isOrganizer ? null : (
          <>
            <Button title="กิจกรรมที่ลงทะเบียน / เช็กอิน" icon="ticket-outline" variant="secondary" onPress={() => router.push('/my')} />
            <Button title="กิจกรรมที่บันทึกไว้" icon="star-outline" variant="secondary" onPress={() => router.push('/saved')} />
          </>
        )}
        <Button title="เนื้อหาสัปดาห์ 1–14 อยู่ตรงไหนในแอป" icon="school-outline" variant="secondary" onPress={() => router.push('/about')} />
      </Card>

      <Button title="ออกจากระบบ" icon="log-out-outline" variant="secondary" onPress={onSignOut} />
      <View style={styles.apiInfo}>
        <Ionicons name="server-outline" size={14} color={Colors.textMuted} />
        <Text style={styles.apiText}>API: {API_URL}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 28, fontWeight: '700', color: Colors.primary },
  name: { fontSize: 20, fontWeight: '700', color: Colors.text },
  muted: { fontSize: 14, color: Colors.textMuted, lineHeight: 20 },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm },
  // บล็อกชั่วโมงสะสมพื้นสีหลัก เป็นจุดเด่นของหน้าโปรไฟล์ (ขาวบน primary 6.9:1)
  hoursHero: { backgroundColor: Colors.primary, borderRadius: Radius.md, padding: Spacing.lg, gap: Spacing.sm },
  heroText: { fontSize: 14, color: Colors.onPrimaryMuted, lineHeight: 20 },
  total: { fontSize: 48, fontWeight: '800', color: Colors.onPrimary },
  totalLabel: { fontSize: 18, color: Colors.onPrimaryMuted },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  barLabel: { width: 100, fontSize: 14, color: Colors.text },
  barTrack: { flex: 1, height: 10, backgroundColor: Colors.background, borderRadius: Radius.pill, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: Radius.pill },
  barCount: { minWidth: 56, textAlign: 'right', fontWeight: '700', color: Colors.text },
  progressTrack: { height: 14, backgroundColor: Colors.primaryDark, borderRadius: Radius.pill, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.onPrimary, borderRadius: Radius.pill },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: 44, paddingVertical: 4 },
  historyDot: { width: 10, height: 10, borderRadius: 5 },
  historyTitle: { fontSize: 15, fontWeight: '600', color: Colors.text },
  historyHours: { fontSize: 15, fontWeight: '800', color: Colors.success },
  gallery: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  photoCell: { width: 140, gap: 4 },
  photo: { width: 140, height: 140, borderRadius: Radius.md, backgroundColor: Colors.border },
  photoTitle: { fontSize: 13, fontWeight: '600', color: Colors.text },
  photoDate: { fontSize: 12, color: Colors.textMuted },
  apiInfo: { flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'center' },
  apiText: { fontSize: 12, color: Colors.textMuted },
});
