import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { LoginPrompt } from '@/components/login-prompt';
import { Banner, Button, StateView, type IconName } from '@/components/ui';
import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useRefreshControl } from '@/hooks/use-refresh-control';
import { formatUpdatedAt } from '@/lib/format';
import { targetFor } from '@/lib/inbox';
import { enableWebNotifications, webNotificationStatus } from '@/services/reminders';
import { useInbox } from '@/state/inbox-context';
import { useAuthenticatedSession } from '@/state/session-context';
import type { InboxItem, InboxKind } from '@/types/models';

const ICONS: Record<InboxKind, IconName> = {
  ticket: 'construct',
  activity: 'megaphone',
  registration: 'ribbon',
  manage: 'document-text',
  broadcast: 'alert-circle',
};

/**
 * ประวัติแจ้งเตือนทั้งหมด (แจ้งเตือนของระบบหายไปเมื่อปัดทิ้ง แต่ที่นี่ย้อนดูได้)
 * เปิดหน้านี้ = อ่านแล้ว ตัวเลขบนแท็บหายไป
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
        {'เบราว์เซอร์บล็อกแจ้งเตือนของเว็บนี้ไว้ เปิดได้ที่ไอคอนหน้าช่อง URL → การแจ้งเตือน → อนุญาต แล้วรีเฟรชหน้า\nระหว่างนี้แจ้งเตือนใหม่จะแสดงเป็นแถบด้านบนของแอป'}
      </Banner>
    );
  }
  if (status === 'unsupported') {
    return <Banner tone="info">เบราว์เซอร์นี้ไม่มีแจ้งเตือนของระบบ แจ้งเตือนใหม่จะแสดงเป็นแถบด้านบนของแอปและเก็บไว้ที่นี่</Banner>;
  }
  return (
    <View style={styles.webCard}>
      <Text style={styles.webTitle}>ให้คอมเครื่องนี้เด้งแจ้งเตือน</Text>
      <Text style={styles.webText}>ตอนนี้แจ้งเตือนใหม่แสดงเป็นแถบในแอปเท่านั้น เปิดแจ้งเตือนเพื่อให้เด้งมุมจอแม้กำลังดูแท็บหรือโปรแกรมอื่น</Text>
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
      <Text style={styles.webText}>ให้เด้งทันทีเมื่อเจ้าหน้าที่รับเรื่อง ผลตรวจหลักฐานออก หรือมีประกาศ แม้ปิดแอปอยู่</Text>
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
  const { items, markAllRead, refresh } = useInbox();
  const refreshControl = useRefreshControl(refresh);

  useFocusEffect(
    useCallback(() => {
      markAllRead();
    }, [markAllRead]),
  );

  if (!session) {
    return (
      <LoginPrompt
        icon="notifications-outline"
        title="การแจ้งเตือนของคุณ"
        message="เข้าสู่ระบบเพื่อรับแจ้งเมื่อมีคนรับเรื่องที่คุณแจ้ง ผลตรวจหลักฐานกิจกรรม หรือประกาศจากเจ้าหน้าที่"
        next="/inbox"
      />
    );
  }

  const open = (item: InboxItem) => {
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
        Platform.OS === 'web' ? <WebNotificationCard /> : <PushCard />
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() => open(item)}
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
          accessibilityLabel={`${item.title}. ${item.body}. ${formatUpdatedAt(item.createdAt)}`}>
          <View style={styles.icon}>
            <Ionicons name={ICONS[item.kind]} size={20} color={Colors.primary} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.body}>{item.body}</Text>
            <Text style={styles.time}>{formatUpdatedAt(item.createdAt)}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
        </Pressable>
      )}
      ListEmptyComponent={
        <StateView
          kind="empty"
          icon="notifications-off-outline"
          title="ยังไม่มีแจ้งเตือน"
          message="เมื่อมีคนรับเรื่องที่คุณแจ้ง ผลตรวจหลักฐานกิจกรรม หรือเจ้าหน้าที่ประกาศ จะเด้งมาที่นี่"
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
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 15, fontWeight: '700', color: Colors.text },
  body: { fontSize: 14, color: Colors.text, lineHeight: 20 },
  time: { fontSize: 12, color: Colors.textMuted },
});
