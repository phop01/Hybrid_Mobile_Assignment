import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { ProgressRing } from '@/components/progress-ring';
import { RoleSwitcher } from '@/components/role-switcher';
import { LoginPrompt } from '@/components/login-prompt';
import { Banner, Button, Card, Chip, Screen, SectionTitle } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { REQUIRED_HOURS, summarizeAttendance } from '@/lib/attendance';
import { CATEGORIES, CATEGORY_ORDER } from '@/lib/categories';
import { formatDate } from '@/lib/format';
import { confirmAction } from '@/lib/platform-actions';
import { pickAvatarImage, preparePhotoForUpload } from '@/services/photo';
import { useActivities } from '@/state/activities-context';
import { useMyRegistrations } from '@/state/my-registrations-context';
import { useAuthenticatedSession, useSession } from '@/state/session-context';
import { TEXT_SCALES, useTextScale } from '@/state/text-scale';
import type { Category } from '@/types/models';
import { Text } from '@/components/app-text';

export default function ProfileScreen() {
  const session = useAuthenticatedSession();
  const { signOut, updateProfile } = useSession();
  const { scaleKey, setScaleKey } = useTextScale();
  const [saving, setSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const { registrations } = useMyRegistrations();
  const { activities, getById } = useActivities();

  if (!session) {
    return (
      <LoginPrompt
        icon="person-circle-outline"
        title="โปรไฟล์และชั่วโมงสะสม"
        message="เข้าสู่ระบบเพื่อดูชั่วโมงกิจกรรม/จิตอาสา และประวัติกิจกรรม"
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

  const interests = user.interests ?? [];

  const saveProfile = async (input: Parameters<typeof updateProfile>[0]) => {
    setSaving(true);
    setProfileError(null);
    try {
      await updateProfile(input);
    } catch (e) {
      setProfileError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง');
    } finally {
      setSaving(false);
    }
  };

  const changeAvatar = async () => {
    try {
      const uri = await pickAvatarImage();
      if (uri) await saveProfile({ avatarBase64: (await preparePhotoForUpload(uri)).base64 });
    } catch (e) {
      setProfileError(e instanceof Error ? e.message : 'ใช้รูปนี้ไม่ได้ ลองเลือกรูปอื่น');
    }
  };

  // กำลังบันทึกอยู่ไม่รับแตะซ้ำ: ไม่งั้นการแตะสองหมวดติดกันจะอ่านรายการเดิมทั้งคู่ แล้วหมวดแรกหายไป
  const toggleInterest = (category: Category) =>
    !saving &&
    saveProfile({ interests: interests.includes(category) ? interests.filter((c) => c !== category) : [...interests, category] });

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
        <Pressable
          onPress={changeAvatar}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel={user.avatarUrl ? 'เปลี่ยนรูปโปรไฟล์' : 'ตั้งรูปโปรไฟล์'}>
          <Avatar name={user.fullName} url={user.avatarUrl} size={72} />
          <View style={styles.cameraBadge}>
            <Ionicons name="camera" size={14} color={Colors.onPrimary} />
          </View>
        </Pressable>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.name}>{user.fullName}</Text>
          <Text style={styles.muted}>
            {isOrganizer ? 'เจ้าหน้าที่ · รหัสบุคลากร' : 'รหัสนักศึกษา'} {user.studentId}
          </Text>
          <Text style={styles.muted}>{user.faculty}</Text>
        </View>
      </Card>

      {profileError ? <Banner tone="danger">{profileError}</Banner> : null}

      <Card>
        <SectionTitle>ความสนใจ</SectionTitle>
        <Text style={styles.muted}>เลือกหมวดที่ชอบ หน้า “วันนี้” จะแนะนำกิจกรรมตามที่เลือก</Text>
        <View style={styles.chips}>
          {CATEGORY_ORDER.map((c) => (
            <Chip key={c} label={CATEGORIES[c].label} color={CATEGORIES[c].color} selected={interests.includes(c)} onPress={() => toggleInterest(c)} />
          ))}
        </View>
        {user.avatarUrl ? <Button title="ลบรูปโปรไฟล์" icon="trash-outline" variant="ghost" onPress={() => saveProfile({ avatarBase64: null })} /> : null}
      </Card>

      {isOrganizer ? (
        <Card>
          <SectionTitle>เจ้าหน้าที่งานกิจกรรมนักศึกษา</SectionTitle>
          <Text style={styles.muted}>สร้างกิจกรรมและตรวจหลักฐานการเข้าร่วมที่แท็บ “จัดการ” · ส่งประกาศจากหน้า “วันนี้”</Text>
          <Button title="ไปหน้าจัดการ" icon="clipboard-outline" onPress={() => router.push('/manage')} />
        </Card>
      ) : (
        <>
          <Card>
            <SectionTitle>ชั่วโมงกิจกรรม</SectionTitle>
            <View style={styles.hoursHero}>
              <View
                style={styles.heroRow}
                accessible
                accessibilityLabel={`สะสม ${summary.hours} จาก ${REQUIRED_HOURS} ชั่วโมง จาก ${summary.total} กิจกรรม`}>
                <ProgressRing progress={summary.progress} label="ของเป้าหมาย" />
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={styles.totalRow}>
                    <Text style={styles.total}>{summary.hours}</Text>
                    <Text style={styles.totalLabel}>/ {REQUIRED_HOURS} ชม.</Text>
                  </View>
                  <Text style={styles.heroText}>จาก {summary.total} กิจกรรม</Text>
                  <Text style={styles.heroText}>
                    {summary.hours >= REQUIRED_HOURS ? 'ครบตามเป้าหมายแล้ว 🎉' : `อีก ${REQUIRED_HOURS - summary.hours} ชม. จะครบเป้าหมาย`}
                  </Text>
                </View>
              </View>
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

      <Card>
        <SectionTitle>ขนาดตัวอักษร</SectionTitle>
        <View style={styles.chips}>
          {TEXT_SCALES.map((o) => (
            <Chip key={o.key} label={o.label} selected={scaleKey === o.key} onPress={() => setScaleKey(o.key)} />
          ))}
        </View>
        <Text style={styles.muted}>ตัวอย่าง: กิจกรรมจิตอาสาปลูกป่า วันเสาร์ 8:00 น.</Text>
      </Card>

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
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
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
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: 44, paddingVertical: 4 },
  historyDot: { width: 10, height: 10, borderRadius: 5 },
  historyTitle: { fontSize: 15, fontWeight: '600', color: Colors.text },
  historyHours: { fontSize: 15, fontWeight: '800', color: Colors.success },
});
