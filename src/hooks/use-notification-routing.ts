import type { NotificationResponse } from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';

import { targetFor } from '@/lib/inbox';
import { Notifications } from '@/services/notifications-module';

// registrationId จาก server เป็น UUID ข้อมูลใน notification ไม่น่าเชื่อถือ จึงตรวจรูปแบบก่อนใช้
const ID_PATTERN = /^[0-9a-f-]{36}$/i;

function openFromResponse(response: NotificationResponse | null) {
  if (!Notifications || !response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
  const data = response.notification.request.content.data as Record<string, unknown> | undefined;

  // จากกล่องแจ้งเตือน (กิจกรรม / ผลตรวจหลักฐาน / งานตรวจของผู้จัด)
  if (data?.type === 'inbox') {
    const target = targetFor(data.kind, data.targetId);
    if (target) router.push(target as never);
    return;
  }

  // เตือนก่อนกิจกรรม → เปิดหน้าเช็กอิน
  const id = data?.registrationId;
  if (data?.type === 'checkin' && typeof id === 'string' && ID_PATTERN.test(id)) {
    router.push({ pathname: '/check-in/[registrationId]', params: { registrationId: id } });
  }
}

/**
 * เปิดหน้าที่ถูกต้องเมื่อแตะแจ้งเตือน รองรับทั้ง
 * - cold start (แอปปิดอยู่): อ่าน response ที่ใช้เปิดแอป
 * - แอปเปิดอยู่ / อยู่เบื้องหลัง: ใช้ listener
 * รอจน session โหลดเสร็จ (ready) ก่อน เพราะหน้าปลายทางต้อง login
 * payload เก็บแค่ ID หน้าปลายทางโหลดข้อมูลล่าสุดเอง และแสดงหน้า "ไม่พบ" ถ้าเรื่องถูกลบไปแล้ว
 */
export function useNotificationRouting(ready: boolean) {
  useEffect(() => {
    if (!ready || !Notifications) return;
    let cancelled = false;

    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (cancelled || !response) return;
      openFromResponse(response);
      Notifications?.clearLastNotificationResponseAsync().catch(() => undefined);
    });

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      openFromResponse(response);
      Notifications?.clearLastNotificationResponseAsync().catch(() => undefined);
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [ready]);
}
