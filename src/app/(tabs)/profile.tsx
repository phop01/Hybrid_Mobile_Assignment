import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/app-text';
import { Avatar } from '@/components/avatar';
import { HoursCard } from '@/components/hours-card';
import { LoginPrompt } from '@/components/login-prompt';
import { RoleSwitcher } from '@/components/role-switcher';
import { TopBar } from '@/components/top-bar';
import { Banner, Button, Card, Chip, Screen, SectionHeader, StatPill, type IconName } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { summarizeAttendance } from '@/lib/attendance';
import { computeBadges } from '@/lib/badges';
import { CATEGORIES, CATEGORY_ORDER } from '@/lib/categories';
import { confirmAction } from '@/lib/platform-actions';
import { pickAvatarImage, preparePhotoForUpload } from '@/services/photo';
import { useActivities } from '@/state/activities-context';
import { useMyRegistrations } from '@/state/my-registrations-context';
import { useAuthenticatedSession, useSession } from '@/state/session-context';
import type { Category } from '@/types/models';

export default function ProfileScreen() {
  const session = useAuthenticatedSession();
  const { signOut, updateProfile } = useSession();
  const [saving, setSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const { registrations } = useMyRegistrations();
  const { activities } = useActivities();

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
  const badges = computeBadges(summary);
  const earnedCount = badges.filter((b) => b.earned).length;
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
      <TopBar eyebrow="PROFILE · ฉัน" title="โปรไฟล์ของฉัน" right={<View />} />
      <RoleSwitcher />

      {/* การ์ดตัวตน: รูป (แตะเปลี่ยน) ชื่อ รหัส คณะ + ตัวเลขสรุป */}
      <View style={styles.identity}>
        <View style={styles.identityRow}>
          <Pressable
            onPress={changeAvatar}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel={user.avatarUrl ? 'เปลี่ยนรูปโปรไฟล์' : 'ตั้งรูปโปรไฟล์'}
            style={styles.avatarRing}>
            <Avatar name={user.fullName} url={user.avatarUrl} size={76} />
            <View style={styles.cameraBadge}>
              <Ionicons name="camera" size={14} color={Colors.ink} />
            </View>
          </Pressable>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.name}>{user.fullName}</Text>
            <Text style={styles.idText}>
              {isOrganizer ? 'เจ้าหน้าที่ · รหัสบุคลากร' : 'รหัสนักศึกษา'} {user.studentId}
            </Text>
            <Text style={styles.idText}>{user.faculty}</Text>
          </View>
        </View>
        {isOrganizer ? (
          <View style={styles.pills}>
            <StatPill tone="accent" icon="clipboard" label="เจ้าหน้าที่งานกิจกรรม" />
          </View>
        ) : (
          <View style={styles.pills}>
            <StatPill tone="accent" icon="time" label={`${summary.hours} ชั่วโมง`} />
            <StatPill tone="dark" icon="checkmark-circle" label={`${summary.total} กิจกรรม`} />
            <StatPill tone="dark" icon="medal" label={`เหรียญ ${earnedCount}/${badges.length}`} />
          </View>
        )}
        {user.avatarUrl ? (
          <Pressable
            onPress={() => saveProfile({ avatarBase64: null })}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel="ลบรูปโปรไฟล์"
            hitSlop={8}
            style={styles.removePhoto}>
            <Ionicons name="trash-outline" size={14} color={Colors.onPrimaryMuted} />
            <Text style={styles.removePhotoText}>ลบรูปโปรไฟล์</Text>
          </Pressable>
        ) : null}
      </View>

      {profileError ? <Banner tone="danger">{profileError}</Banner> : null}

      {isOrganizer ? (
        <Card>
          <SectionHeader eyebrow="ORGANIZER" title="เจ้าหน้าที่งานกิจกรรมนักศึกษา" />
          <Text style={styles.muted}>สร้างกิจกรรมและตรวจหลักฐานการเข้าร่วมที่แท็บ “จัดการ” · ส่งประกาศจากหน้า “วันนี้”</Text>
          <Button title="ไปหน้าจัดการ" icon="clipboard-outline" onPress={() => router.push('/manage')} />
        </Card>
      ) : (
        <>
          <Card>
            <SectionHeader eyebrow="INTERESTS" title="ความสนใจ" />
            <Text style={styles.muted}>เลือกได้หลายหมวด หน้า “วันนี้” จะแนะนำกิจกรรมใหม่ล่าสุดในหมวดที่เลือก</Text>
            <View style={styles.chips}>
              {CATEGORY_ORDER.map((c) => (
                <Chip
                  key={c}
                  label={CATEGORIES[c].label}
                  color={CATEGORIES[c].color}
                  selected={interests.includes(c)}
                  onPress={() => toggleInterest(c)}
                />
              ))}
            </View>
          </Card>

          <HoursCard summary={summary} />

          <View style={{ gap: Spacing.md }}>
            <SectionHeader eyebrow="BADGES" title={`เหรียญความสำเร็จ ${earnedCount}/${badges.length}`} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badges}>
              {badges.map((b) => (
                <View
                  key={b.id}
                  style={[styles.badge, b.earned && styles.badgeOn]}
                  accessible
                  accessibilityLabel={`${b.label} ${b.earned ? 'ได้แล้ว' : `ยังไม่ได้: ${b.hint}`}`}>
                  <View style={[styles.medal, b.earned && styles.medalOn]}>
                    <Ionicons name={b.earned ? b.icon : 'lock-closed'} size={24} color={b.earned ? Colors.ink : Colors.textMuted} />
                  </View>
                  <Text style={[styles.badgeLabel, b.earned && { color: Colors.onPrimary }]}>{b.label}</Text>
                  <Text style={[styles.badgeHint, b.earned && { color: Colors.highlight }]}>{b.earned ? 'ได้แล้ว' : b.hint}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </>
      )}

      <Card>
        <SectionHeader eyebrow="SHORTCUTS" title="ทางลัด" />
        {isOrganizer ? null : (
          <>
            <LinkRow icon="ticket" label="กิจกรรมที่ลงทะเบียน / เช็กอิน" onPress={() => router.push('/my')} />
            <LinkRow icon="star" label="กิจกรรมที่บันทึกไว้" onPress={() => router.push('/saved')} />
            <LinkRow icon="time" label="ชั่วโมงกิจกรรมแยกตามหมวด" onPress={() => router.push('/hours')} />
          </>
        )}
        <LinkRow icon="school" label="เนื้อหาสัปดาห์ 1–14 อยู่ตรงไหนในแอป" onPress={() => router.push('/about')} />
      </Card>

      <Button title="ออกจากระบบ" icon="log-out-outline" variant="secondary" onPress={onSignOut} />
    </Screen>
  );
}

function LinkRow({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.linkRow, pressed && { opacity: 0.8 }]}>
      <View style={styles.linkIcon}>
        <Ionicons name={icon} size={18} color={Colors.primary} />
      </View>
      <Text style={styles.linkLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  identity: { backgroundColor: Colors.ink, borderRadius: Radius.xxl, padding: Spacing.xl, gap: Spacing.lg },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  avatarRing: { borderRadius: 42, borderWidth: 2, borderColor: Colors.highlight, padding: 2 },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.highlight,
    borderWidth: 2,
    borderColor: Colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 21, fontWeight: '800', color: Colors.onPrimary },
  idText: { fontSize: 13, color: Colors.onPrimaryMuted, lineHeight: 19 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  removePhoto: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  removePhotoText: { fontSize: 12, color: Colors.onPrimaryMuted, textDecorationLine: 'underline' },
  muted: { fontSize: 13, color: Colors.textMuted, lineHeight: 19 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  badges: { gap: Spacing.md, paddingRight: Spacing.lg },
  badge: {
    width: 116,
    alignItems: 'center',
    gap: 6,
    padding: Spacing.md,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  badgeOn: { backgroundColor: Colors.ink, borderColor: Colors.ink },
  medal: { width: 54, height: 54, borderRadius: 27, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
  medalOn: { backgroundColor: Colors.highlight },
  badgeLabel: { fontSize: 13, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  badgeHint: { fontSize: 11, color: Colors.textMuted, textAlign: 'center', lineHeight: 15 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: 48 },
  linkIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  linkLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.text },
});
