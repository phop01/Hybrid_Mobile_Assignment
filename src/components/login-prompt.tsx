import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { StateView, type IconName } from './ui';

/** แท็บที่ต้อง login ยังแสดงอยู่ ผู้ใช้จะรู้ว่ามีฟีเจอร์นี้ และเข้าสู่ระบบได้จากตรงนั้นเลย · จัดไว้กลางจอ */
export function LoginPrompt({ title, message, icon, next }: { title: string; message: string; icon: IconName; next: string }) {
  return (
    <View style={styles.center}>
      <StateView
        kind="empty"
        icon={icon}
        title={title}
        message={message}
        actionLabel="เข้าสู่ระบบ"
        onAction={() => router.push({ pathname: '/login', params: { next } })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', backgroundColor: Colors.background },
});
