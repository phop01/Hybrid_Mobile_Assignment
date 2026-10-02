import { router, Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import '@/lib/ignore-font-timeout';
import { InboxToast } from '@/components/inbox-toast';
import { PhoneFrame } from '@/components/phone-frame';
import { Colors } from '@/constants/theme';
import { useNotificationRouting } from '@/hooks/use-notification-routing';
import { ActivitiesProvider } from '@/state/activities-context';
import { BroadcastsProvider } from '@/state/broadcasts-context';
import { FavoritesProvider } from '@/state/favorites-context';
import { InboxProvider } from '@/state/inbox-context';
import { MyRegistrationsProvider } from '@/state/my-registrations-context';
import { TextScaleProvider } from '@/state/text-scale-context';
import { isActivitiesStaff } from '@/lib/roles';
import { consumePostLoginRedirect, SessionProvider, useSession } from '@/state/session-context';

SplashScreen.preventAutoHideAsync();

// กด back จากหน้าที่เปิดผ่าน deep link/แจ้งเตือน จะกลับมาที่แท็บหลัก ไม่หลุดออกจากแอป
export const unstable_settings = { anchor: '(tabs)' };

export default function RootLayout() {
  return (
    <TextScaleProvider>
    <SessionProvider>
      <InboxProvider>
        <ActivitiesProvider>
          <FavoritesProvider>
            <MyRegistrationsProvider>
              <BroadcastsProvider>
                <StatusBar style="dark" />
                {/* เว็บจอกว้าง: แสดงเป็นกรอบมือถือ · มือถือ: ไม่มีผล */}
                <PhoneFrame>
                  <RootNavigator />
                  <InboxToast />
                </PhoneFrame>
              </BroadcastsProvider>
            </MyRegistrationsProvider>
          </FavoritesProvider>
        </ActivitiesProvider>
      </InboxProvider>
    </SessionProvider>
    </TextScaleProvider>
  );
}

function RootNavigator() {
  const { session } = useSession();
  const ready = session.status !== 'loading';

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  useNotificationRouting(ready);

  // login สำเร็จ → พาไปหน้าที่ผู้ใช้ตั้งใจจะไป หลัง Stack.Protected ปิดหน้า login เสร็จ
  // (ถ้า push ก่อนหน้า login ถูกปิด Stack จะย้อนกลับไปหน้าก่อน login ทำให้ไม่ถึงหน้าที่ตั้งใจ)
  // ค่าที่จำไว้ถูกตั้งเฉพาะตอนกดเข้าสู่ระบบ/สมัคร จึงไม่ต้องจับจังหวะเปลี่ยนสถานะ
  const pathname = usePathname();
  useEffect(() => {
    if (session.status !== 'authenticated' || pathname === '/login' || pathname === '/register') return;
    const next = consumePostLoginRedirect();
    if (next) router.push(next as never);
  }, [session.status, pathname]);

  // ยังตรวจ session ไม่เสร็จ → ค้าง splash ไว้ หน้าที่ต้อง login จะไม่กระพริบให้เห็นก่อน
  if (!ready) return null;
  const isAuthenticated = session.status === 'authenticated';
  const isOrganizer = isAuthenticated && session.user.role === 'organizer';
  // สร้าง/จัดการกิจกรรม: เฉพาะเจ้าหน้าที่งานกิจกรรม (server ตอบ 403 กับเจ้าหน้าที่อาคาร)
  const isActivityOrganizer = isAuthenticated && isActivitiesStaff(session.user);

  return (
    <Stack
      screenOptions={{
        headerBackTitle: 'กลับ',
        headerTintColor: Colors.primary,
        headerTitleStyle: { color: Colors.text },
        contentStyle: { backgroundColor: Colors.background },
      }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="activities/[id]/index" options={{ title: 'รายละเอียดกิจกรรม' }} />
      <Stack.Screen name="about" options={{ title: 'เนื้อหาสัปดาห์ 1–14 ในแอป' }} />
      <Stack.Screen name="saved" options={{ title: 'กิจกรรมที่บันทึกไว้' }} />
      <Stack.Screen name="directions" options={{ title: 'เส้นทาง' }} />

      {/* login มีเฉพาะตอนยังไม่เข้าระบบ */}
      <Stack.Protected guard={!isAuthenticated}>
        <Stack.Screen name="login" options={{ title: 'เข้าสู่ระบบ' }} />
        <Stack.Screen name="register" options={{ title: 'สมัครสมาชิก' }} />
      </Stack.Protected>

      {/* หน้าที่ต้องรู้ว่าเป็นใคร: ลงทะเบียน ดูการลงทะเบียน และเช็กอิน */}
      <Stack.Protected guard={isAuthenticated}>
        <Stack.Screen name="activities/[id]/register" options={{ title: 'ลงทะเบียนกิจกรรม' }} />
        <Stack.Screen name="registrations/[id]" options={{ title: 'การลงทะเบียนของฉัน' }} />
        <Stack.Screen name="check-in/[registrationId]" options={{ title: 'เช็กอิน' }} />
        <Stack.Screen name="my" options={{ title: 'กิจกรรมที่ลงทะเบียน' }} />
      </Stack.Protected>

      {/* ฝั่งผู้จัดกิจกรรม: เฉพาะเจ้าหน้าที่งานกิจกรรม (server ตรวจซ้ำทุก request) */}
      <Stack.Protected guard={isActivityOrganizer}>
        <Stack.Screen name="organizer/new" options={{ title: 'สร้างกิจกรรม' }} />
        <Stack.Screen name="organizer/[id]" options={{ title: 'ผู้เข้าร่วมและหลักฐาน' }} />
      </Stack.Protected>

      {/* ส่งประกาศทั่ววิทยาเขต: เจ้าหน้าที่ทุกหน่วยงาน */}
      <Stack.Protected guard={isOrganizer}>
        <Stack.Screen name="broadcast/new" options={{ title: 'ส่งประกาศ' }} />
      </Stack.Protected>

      <Stack.Screen name="+not-found" options={{ title: 'ไม่พบหน้านี้' }} />
    </Stack>
  );
}
