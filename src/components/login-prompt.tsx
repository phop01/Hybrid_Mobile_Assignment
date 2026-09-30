import { router } from 'expo-router';

import { StateView, type IconName } from './ui';

/** แท็บที่ต้อง login ยังแสดงอยู่ ผู้ใช้จะรู้ว่ามีฟีเจอร์นี้ และเข้าสู่ระบบได้จากตรงนั้นเลย */
export function LoginPrompt({ title, message, icon, next }: { title: string; message: string; icon: IconName; next: string }) {
  return (
    <StateView
      kind="empty"
      icon={icon}
      title={title}
      message={message}
      actionLabel="เข้าสู่ระบบ"
      onAction={() => router.push({ pathname: '/login', params: { next } })}
    />
  );
}
