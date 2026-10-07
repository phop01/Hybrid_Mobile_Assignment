import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { Text } from '@/components/app-text';
import { Avatar } from '@/components/avatar';
import { HoursCard } from '@/components/hours-card';
import { LoginPrompt } from '@/components/login-prompt';
import { RoleSwitcher } from '@/components/role-switcher';
import { SelectField } from '@/components/select-field';
import { TopBar } from '@/components/top-bar';
import { Banner, Button, Card, Screen, SectionHeader, StatPill, TextField, type IconName } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { summarizeAttendance } from '@/lib/attendance';
import { computeBadges, type Badge } from '@/lib/badges';
import { MAJORS } from '@/lib/majors';
import { confirmAction } from '@/lib/platform-actions';
import { pickAvatarImage, preparePhotoForUpload } from '@/services/photo';
import { useActivities } from '@/state/activities-context';
import { useMyRegistrations } from '@/state/my-registrations-context';
import { useAuthenticatedSession, useSession } from '@/state/session-context';
import { HScroll } from '@/components/h-scroll';

export default function ProfileScreen() {
  const session = useAuthenticatedSession();
  const { signOut, updateProfile } = useSession();
  const [saving, setSaving] = useState(false);
  // แก้ไขข้อมูลในการ์ดตัวตน: ร่างไว้ก่อน (รวมรูป) กด "บันทึก" ค่อยส่ง · "ยกเลิก" = ทิ้งทั้งหมด
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftMajor, setDraftMajor] = useState('');
  const [nameError, setNameError] = useState<string | undefined>();
  // undefined = ไม่เปลี่ยนรูป · null = ลบรูป · object = รูปใหม่ที่เลือกไว้ (ยังไม่ส่ง)
  const [draftAvatar, setDraftAvatar] = useState<{ uri: string; base64: string } | null | undefined>();
  // เหรียญ: ปกติเลื่อนดูแนวนอน · กด "ดูทั้งหมด" กางเป็นตารางเห็นครบทุกอัน
  const [badgesOpen, setBadgesOpen] = useState(false);
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
  // กิจกรรมที่เข้าร่วมแล้วล่าสุด แสดงในการ์ดชั่วโมงตอนกางดู
  const recent = registrations
    .filter((r) => r.status === 'checked_in')
    .flatMap((r) => {
      const activity = activities.find((a) => a.id === r.activityId);
      return activity ? [activity] : [];
    })
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
    .slice(0, 3);

  const saveProfile = async (input: Parameters<typeof updateProfile>[0]) => {
    setSaving(true);
    setProfileError(null);
    try {
      await updateProfile(input);
      return true;
    } catch (e) {
      setProfileError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const pickDraftAvatar = async () => {
    try {
      const uri = await pickAvatarImage();
      if (uri) setDraftAvatar(await preparePhotoForUpload(uri));
    } catch (e) {
      setProfileError(e instanceof Error ? e.message : 'ใช้รูปนี้ไม่ได้ ลองเลือกรูปอื่น');
    }
  };

  const openEditor = () => {
    setDraftName(user.fullName);
    setDraftMajor(user.major ?? '');
    setDraftAvatar(undefined);
    setNameError(undefined);
    setProfileError(null);
    setEditing(true);
  };

  const saveEdits = async () => {
    const fullName = draftName.trim();
    if (fullName.length < 4 || fullName.length > 80) {
      setNameError('กรุณากรอกชื่อ-นามสกุล');
      return;
    }
    // ส่งเฉพาะช่องที่เปลี่ยน
    const input: Parameters<typeof updateProfile>[0] = {};
    if (fullName !== user.fullName) input.fullName = fullName;
    if (!isOrganizer && draftMajor !== (user.major ?? '')) input.major = draftMajor || null;
    if (draftAvatar !== undefined) input.avatarBase64 = draftAvatar?.base64 ?? null;
    if (Object.keys(input).length === 0 || (await saveProfile(input))) setEditing(false);
  };

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
      <TopBar
        eyebrow="PROFILE · ฉัน"
        title="โปรไฟล์ของฉัน"
        right={
          <Pressable
            onPress={onSignOut}
            accessibilityRole="button"
            accessibilityLabel="ออกจากระบบ"
            hitSlop={6}
            style={({ pressed }) => [styles.signOut, pressed && { opacity: 0.8 }]}>
            <Ionicons name="log-out-outline" size={16} color="#FFFFFF" />
            <Text style={styles.signOutText}>ออกจากระบบ</Text>
          </Pressable>
        }
      />
      <RoleSwitcher />

      {/* การ์ดตัวตน: รูป (แตะเปลี่ยน) ชื่อ รหัส คณะ + ตัวเลขสรุป */}
      <View style={styles.identity}>
        <View style={styles.identityRow}>
          <Pressable
            onPress={editing ? pickDraftAvatar : openEditor}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel={user.avatarUrl ? 'เปลี่ยนรูปโปรไฟล์' : 'ตั้งรูปโปรไฟล์'}
            style={styles.avatarRing}>
            <Avatar name={user.fullName} url={editing && draftAvatar !== undefined ? (draftAvatar?.uri ?? null) : user.avatarUrl} size={76} />
            <View style={styles.cameraBadge}>
              <Ionicons name="camera" size={14} color={Colors.ink} />
            </View>
          </Pressable>
          <View style={{ flex: 1, gap: 2, paddingRight: Spacing.xl }}>
            <Text style={styles.name}>{user.fullName}</Text>
            <Text style={styles.idText}>
              {isOrganizer ? 'เจ้าหน้าที่ · รหัสบุคลากร' : 'รหัสนักศึกษา'} {user.studentId}
            </Text>
            <Text style={styles.idText}>{user.faculty}</Text>
            {user.major ? <Text style={styles.idText}>สาขา{user.major}</Text> : null}
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
        {editing ? null : (
          <Pressable
            onPress={openEditor}
            accessibilityRole="button"
            accessibilityLabel="แก้ไขข้อมูล"
            hitSlop={8}
            style={({ pressed }) => [styles.editButton, pressed && { opacity: 0.8 }]}>
            <Ionicons name="pencil" size={16} color={Colors.ink} />
          </Pressable>
        )}
      </View>

      {profileError ? <Banner tone="danger">{profileError}</Banner> : null}

      {/* แก้ไขข้อมูล: กางเฉพาะตอนกดปุ่ม "แก้ไข" ในการ์ดตัวตน · รหัสนักศึกษาแก้ไม่ได้ (ใช้เข้าสู่ระบบ) */}
      {editing ? (
        <Card>
          <SectionHeader eyebrow="EDIT PROFILE" title="แก้ไขข้อมูล" />
          {/* รูปที่เลือกแสดงในการ์ดด้านบนทันที แต่ยังไม่บันทึกจนกว่าจะกด "บันทึก" */}
          <View style={styles.photoRow}>
            <Button
              title={(draftAvatar === undefined ? user.avatarUrl : draftAvatar) ? 'เปลี่ยนรูป' : 'เพิ่มรูป'}
              icon="camera-outline"
              variant="secondary"
              onPress={pickDraftAvatar}
              disabled={saving}
            />
            {(draftAvatar === undefined ? user.avatarUrl : draftAvatar) ? (
              <Button title="ลบรูป" icon="trash-outline" variant="ghost" onPress={() => setDraftAvatar(null)} disabled={saving} />
            ) : null}
          </View>
          <TextField
            label="ชื่อ-นามสกุล"
            value={draftName}
            onChangeText={(v) => {
              setDraftName(v);
              setNameError(undefined);
            }}
            maxLength={80}
            error={nameError}
          />
          {isOrganizer ? null : (
            <SelectField label="สาขาวิชา" value={draftMajor} options={MAJORS} onChange={setDraftMajor} placeholder="แตะเพื่อเลือกสาขา" />
          )}
          <Text style={styles.muted}>{isOrganizer ? 'รหัสบุคลากร' : 'รหัสนักศึกษา'}ใช้เข้าสู่ระบบ จึงแก้ไม่ได้</Text>
          <View style={styles.photoRow}>
            <Button
              title="ยกเลิก"
              variant="secondary"
              onPress={() => {
                setDraftAvatar(undefined);
                setEditing(false);
              }}
              disabled={saving}
            />
            <Button title="บันทึก" icon="checkmark" onPress={saveEdits} loading={saving} />
          </View>
        </Card>
      ) : null}

      {isOrganizer ? (
        <Card>
          <SectionHeader eyebrow="ORGANIZER" title="เจ้าหน้าที่งานกิจกรรมนักศึกษา" />
          <Text style={styles.muted}>สร้างกิจกรรมและตรวจหลักฐานการเข้าร่วมที่แท็บ “จัดการ”</Text>
          <Button title="ไปหน้าจัดการ" icon="clipboard-outline" onPress={() => router.push('/manage')} />
        </Card>
      ) : (
        <>
          <HoursCard summary={summary} recent={recent} />

          <View style={{ gap: Spacing.md }}>
            <View style={styles.badgesHeader}>
              <View style={{ flex: 1 }}>
                <SectionHeader eyebrow="BADGES" title={`เหรียญความสำเร็จ ${earnedCount}/${badges.length}`} />
              </View>
              <Pressable
                onPress={() => setBadgesOpen((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel={badgesOpen ? 'ย่อเหรียญ' : 'ดูเหรียญทั้งหมด'}
                accessibilityState={{ expanded: badgesOpen }}
                hitSlop={8}
                style={({ pressed }) => [styles.seeAll, pressed && { opacity: 0.8 }]}>
                <Text style={styles.seeAllText}>{badgesOpen ? 'ย่อ' : 'ดูทั้งหมด'}</Text>
                <Ionicons name={badgesOpen ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.primary} />
              </Pressable>
            </View>
            {badgesOpen ? (
              <View style={styles.badgeGrid}>{badges.map((b) => renderBadge(b, styles.badgeCell))}</View>
            ) : (
              <HScroll contentContainerStyle={styles.badges}>{badges.map((b) => renderBadge(b))}</HScroll>
            )}
          </View>
        </>
      )}

      <Card>
        <SectionHeader eyebrow="SHORTCUTS" title="ทางลัด" />
        {isOrganizer ? null : (
          <>
            <LinkRow icon="ticket" label="กิจกรรมที่ลงทะเบียน / เช็กอิน" onPress={() => router.push('/my')} />
            <LinkRow icon="time" label="ชั่วโมงกิจกรรมแยกตามหมวด" onPress={() => router.push('/hours')} />
          </>
        )}
        <LinkRow icon="school" label="เนื้อหาสัปดาห์ 1–14 อยู่ตรงไหนในแอป" onPress={() => router.push('/about')} />
      </Card>

    </Screen>
  );
}

function renderBadge(b: Badge, extra?: ViewStyle) {
  return (
    <View
      key={b.id}
      style={[styles.badge, extra, b.earned && styles.badgeOn]}
      accessible
      accessibilityLabel={`${b.label} ${b.earned ? 'ได้แล้ว' : `ยังไม่ได้: ${b.hint}`}`}>
      <View style={[styles.medal, b.earned && styles.medalOn]}>
        <Ionicons name={b.earned ? b.icon : 'lock-closed'} size={24} color={b.earned ? Colors.ink : Colors.textMuted} />
      </View>
      <Text style={[styles.badgeLabel, b.earned && { color: Colors.onPrimary }]}>{b.label}</Text>
      <Text style={[styles.badgeHint, b.earned && { color: Colors.highlight }]}>{b.earned ? 'ได้แล้ว' : b.hint}</Text>
    </View>
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
  identity: {
    backgroundColor: Colors.ink,
    borderRadius: Radius.xxl,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  avatarRing: {
    borderRadius: 42,
    borderWidth: 2,
    borderColor: Colors.highlight,
    padding: 2,
  },
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
  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    backgroundColor: Colors.danger,
  },
  signOutText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  editButton: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.highlight,
  },
  name: { fontSize: 21, fontWeight: '800', color: Colors.onPrimary },
  idText: { fontSize: 13, color: Colors.onPrimaryMuted, lineHeight: 19 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  muted: { fontSize: 13, color: Colors.textMuted, lineHeight: 19 },
  badges: { gap: Spacing.md, paddingRight: Spacing.lg },
  badgesHeader: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 32 },
  seeAllText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: Spacing.sm },
  badgeCell: { width: '32%' },
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
  medal: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medalOn: { backgroundColor: Colors.highlight },
  badgeLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
  },
  badgeHint: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 15,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: 48,
  },
  linkIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  linkLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.text },
});
