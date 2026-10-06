import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, View } from 'react-native';

import { LoginPrompt } from '@/components/login-prompt';
import { TopBar } from '@/components/top-bar';
import { Banner, Button, StateView, type IconName } from '@/components/ui';
import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useRefreshControl } from '@/hooks/use-refresh-control';
import { formatUpdatedAt } from '@/lib/format';
import { targetFor } from '@/lib/inbox';
import { enableWebNotifications, webNotificationStatus } from '@/services/reminders';
import { useInbox } from '@/state/inbox-context';
import { useAuthenticatedSession } from '@/state/session-context';
import type { InboxItem, InboxKind } from '@/types/models';
import { Text } from '@/components/app-text';

const ICONS: Record<InboxKind, { icon: IconName; color: string; bg: string }> = {
  activity: { icon: 'megaphone', color: Colors.primary, bg: Colors.primarySoft },
  registration: { icon: 'ribbon', color: Colors.success, bg: Colors.successSoft },
  manage: { icon: 'document-text', color: Colors.accent, bg: Colors.accentSoft },
};

/**
 * ประวัติแจ้งเตือนทั้งหมด (แจ้งเตือนของระบบหายไปเมื่อปัดทิ้ง แต่ที่นี่ย้อนดูได้)
 * แต่ละรายการนับเป็น "ยังไม่อ่าน" (มีจุด + เลขบนแท็บ) จนกว่าจะแตะดู หรือกด "อ่านทั้งหมด" มุมขวาบน
 */
/**
 * เว็บ (คอม): เปิดแจ้งเตือนของเบราว์เซอร์ ให้เด้งมุมจอแม้ดูแท็บอื่นอยู่ เช่น แท็บของเจ้าหน้าที่
 * เบราว์เซอร์ให้ขอสิทธิ์ได้เฉพาะตอนผู้ใช้กดปุ่ม จึงไม่ขอเองตอนเปิดหน้า
 */
function WebNotificationCard() {
  const [status, setStatus] = useState(webNotificationStatus);
  if (status === 'granted') {
    return (
      <Banner tone="success" icon="notifications">
        เปิดแจ้งเตือนบนคอมนี้แล้ว แจ้งเตือนใหม่จะเด้งมุมจอแม้กำลังดูแท็บอื่น (และแสดงเป็นแถบด้านบนของแอปด้วย)
      </Banner>
    );
  }
  if (status === 'denied') {
    return (
      <Banner tone="warning" icon="notifications-off">
        {
          'เบราว์เซอร์บล็อกแจ้งเตือนของเว็บนี้ไว้ เปิดได้ที่ไอคอนหน้าช่อง URL → การแจ้งเตือน → อนุญาต แล้วรีเฟรชหน้า\nระหว่างนี้แจ้งเตือนใหม่จะแสดงเป็นแถบด้านบนของแอป'
        }
      </Banner>
    );
  }
  if (status === 'unsupported') {
    return <Banner tone="info">เบราว์เซอร์นี้ไม่มีแจ้งเตือนของระบบ แจ้งเตือนใหม่จะแสดงเป็นแถบด้านบนของแอปและเก็บไว้ที่นี่</Banner>;
  }
  return (
    <View style={styles.webCard}>
      <Text style={styles.webTitle}>ให้คอมเครื่องนี้เด้งแจ้งเตือน</Text>
      <Text style={styles.webText}>
        ตอนนี้แจ้งเตือนใหม่แสดงเป็นแถบในแอปเท่านั้น เปิดแจ้งเตือนเพื่อให้เด้งมุมจอแม้กำลังดูแท็บหรือโปรแกรมอื่น
      </Text>
      <Button title="เปิดแจ้งเตือนบนคอมนี้" icon="notifications" onPress={() => enableWebNotifications().then(setStatus)} />
    </View>
  );
}

/** มือถือ: บอกว่าแจ้งเตือนจะเด้งแม้ปิดแอปไหม และให้กดเปิดได้ถ้ายังไม่อนุญาต */
function PushCard() {
  const { push, enablePush } = useInbox();
  const [busy, setBusy] = useState(false);
  if (push === 'checking') return null;
  if (push === 'active') {
    return (
      <Banner tone="success" icon="notifications">
        แจ้งเตือนเด้งได้แม้ปิดแอปหรือล็อกจอ
      </Banner>
    );
  }
  if (push === 'local') {
    return (
      <Banner tone="success" icon="notifications">
        แจ้งเตือนเด้งได้แม้ออกไปใช้แอปอื่น (อย่าปัดปิดแอปทิ้งจากหน้าสลับแอป)
      </Banner>
    );
  }
  if (push === 'unavailable') {
    return (
      <Banner tone="info" icon="notifications-outline">
        เครื่องนี้แจ้งเตือนได้เฉพาะตอนเปิดแอป เรื่องใหม่ระหว่างปิดแอปจะเด้งทันทีที่เปิดแอปกลับมา
      </Banner>
    );
  }
  return (
    <View style={styles.webCard}>
      <Text style={styles.webTitle}>เปิดแจ้งเตือน</Text>
      <Text style={styles.webText}>ให้เด้งทันทีเมื่อผลตรวจหลักฐานออก หรือกิจกรรมที่ลงไว้มีการเปลี่ยนแปลง</Text>
      <Button
        title="เปิดแจ้งเตือน"
        icon="notifications"
        loading={busy}
        onPress={async () => {
          setBusy(true);
          await enablePush().finally(() => setBusy(false));
        }}
      />
    </View>
  );
}

export default function InboxScreen() {
  const session = useAuthenticatedSession();
  const { items, unread, markAllRead, markRead, isUnread, refresh } = useInbox();
  const refreshControl = useRefreshControl(refresh);

  if (!session) {
    return (
      <LoginPrompt
        icon="notifications-outline"
        title="การแจ้งเตือนของคุณ"
        message="เข้าสู่ระบบเพื่อรับแจ้งผลตรวจหลักฐานกิจกรรม และข่าวจากกิจกรรมที่ลงทะเบียนไว้"
        next="/inbox"
      />
    );
  }

  const open = (item: InboxItem) => {
    markRead(item.id);
    const target = targetFor(item.kind, item.targetId);
    if (target) router.push(target as never);
  };

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      style={{ backgroundColor: Colors.background }}
      contentContainerStyle={styles.list}
      refreshControl={refreshControl}
      ListHeaderComponent={
        <View style={{ gap: Spacing.md }}>
          <TopBar
            eyebrow="NOTIFICATIONS · แจ้งเตือน"
            title="แจ้งเตือน"
            subtitle={
              items.length === 0
                ? 'เรื่องใหม่จากเจ้าหน้าที่และกิจกรรมของคุณ'
                : unread > 0
                  ? `ยังไม่อ่าน ${unread} จาก ${items.length} รายการ`
                  : `${items.length} รายการ · อ่านครบแล้ว`
            }
            right={
              unread > 0 ? (
                <Pressable
                  onPress={markAllRead}
                  accessibilityRole="button"
                  accessibilityLabel="อ่านทั้งหมด"
                  hitSlop={8}
                  style={({ pressed }) => [styles.readAll, pressed && { opacity: 0.8 }]}>
                  <Ionicons name="checkmark-done" size={18} color={Colors.highlight} />
                  <Text style={styles.readAllText}>อ่านทั้งหมด</Text>
                </Pressable>
              ) : undefined
            }
          />
          {Platform.OS === 'web' ? <WebNotificationCard /> : <PushCard />}
        </View>
      }
      renderItem={({ item }) => {
        const fresh = isUnread(item);
        return (
          <Pressable
            onPress={() => open(item)}
            style={({ pressed }) => [styles.row, fresh && styles.rowUnread, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
            accessibilityLabel={`${fresh ? 'ยังไม่อ่าน. ' : ''}${item.title}. ${item.body}. ${formatUpdatedAt(item.createdAt)}`}>
            <View style={[styles.icon, { backgroundColor: ICONS[item.kind].bg }]}>
              <Ionicons name={ICONS[item.kind].icon} size={20} color={ICONS[item.kind].color} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.title, fresh && { fontWeight: '800' }]}>{item.title}</Text>
              <Text style={styles.body}>{item.body}</Text>
              <Text style={styles.time}>{formatUpdatedAt(item.createdAt)}</Text>
            </View>
            {fresh ? <View style={styles.dot} /> : <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />}
          </Pressable>
        );
      }}
      ListEmptyComponent={
        <StateView
          kind="empty"
          icon="notifications-off-outline"
          title="ยังไม่มีแจ้งเตือน"
          message="เมื่อเจ้าหน้าที่ตรวจหลักฐาน หรือกิจกรรมที่ลงไว้มีการเปลี่ยนแปลง จะเด้งมาที่นี่"
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: Spacing.lg, gap: Spacing.sm, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  webCard: { backgroundColor: Colors.primarySoft, borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.sm, marginBottom: Spacing.xs },
  webTitle: { fontSize: 16, fontWeight: '700', color: Colors.primaryDark },
  webText: { fontSize: 14, color: Colors.primaryDark, lineHeight: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowUnread: { backgroundColor: Colors.primarySoft, borderColor: Colors.primary },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.danger },
  readAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.ink,
    borderRadius: Radius.pill,
    paddingHorizontal: 14,
    minHeight: 42,
  },
  readAllText: { color: Colors.highlight, fontWeight: '700', fontSize: 14 },
  title: { fontSize: 15, fontWeight: '700', color: Colors.text },
  body: { fontSize: 14, color: Colors.text, lineHeight: 20 },
  time: { fontSize: 12, color: Colors.textMuted },
});
