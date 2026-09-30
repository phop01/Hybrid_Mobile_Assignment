import { router } from 'expo-router';

import { StateView } from '@/components/ui';

// ลิงก์ผิดหรือ deep link ที่ไม่มีอยู่จริง ต้องมีทางกลับ ไม่ใช่หน้าว่าง
export default function NotFoundScreen() {
  return (
    <StateView
      kind="empty"
      icon="compass-outline"
      title="ไม่พบหน้านี้"
      message="ลิงก์อาจไม่ถูกต้องหรือหน้านี้ถูกย้ายไปแล้ว"
      actionLabel="ไปหน้ากิจกรรม"
      onAction={() => router.replace('/activities')}
    />
  );
}
