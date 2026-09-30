// Android ใน Expo Go (SDK 53+) แค่ import 'expo-notifications' ก็ throw ทันที
// เพราะ index ของไลบรารีโหลด DevicePushTokenAutoRegistration.fx (ลงทะเบียน push ตอนโหลด)
// แต่แจ้งเตือนในเครื่อง (local notification) ยังใช้ได้ จึงโหลดเฉพาะไฟล์ย่อยที่ต้องใช้ ไม่ผ่าน index
// iPhone / development build โหลดทั้งไลบรารีตามปกติ (มี push จาก server)

import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';

type NotificationsModule = typeof import('expo-notifications');

/** เครื่องนี้รับ push จาก server ได้ไหม (Android ใน Expo Go ไม่ได้) */
export const remotePushSupported = !(Platform.OS === 'android' && isRunningInExpoGo());

/* eslint-disable @typescript-eslint/no-require-imports */
function load(): NotificationsModule {
  if (remotePushSupported) return require('expo-notifications') as NotificationsModule;
  return {
    ...require('expo-notifications/build/NotificationsHandler'),
    ...require('expo-notifications/build/NotificationsEmitter'),
    ...require('expo-notifications/build/NotificationPermissions'),
    ...require('expo-notifications/build/NotificationChannelManager.types'),
    ...require('expo-notifications/build/Notifications.types'),
    ...require('expo-notifications/build/setNotificationChannelAsync'),
    ...require('expo-notifications/build/scheduleNotificationAsync'),
    ...require('expo-notifications/build/cancelScheduledNotificationAsync'),
    ...require('expo-notifications/build/cancelAllScheduledNotificationsAsync'),
  } as NotificationsModule;
}
/* eslint-enable @typescript-eslint/no-require-imports */

// เว็บใช้ reminders.web.ts ไม่ได้เรียกไฟล์นี้ · คง `| null` ไว้ให้ผู้เรียกเช็กก่อนใช้เสมอ
export const Notifications: NotificationsModule | null = Platform.OS === 'web' ? null : load();
