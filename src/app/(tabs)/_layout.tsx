import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { isActivitiesStaff } from '@/lib/roles';
import { useInbox } from '@/state/inbox-context';
import { useAuthenticatedSession } from '@/state/session-context';

/**
 * 5 แท็บ = เรื่องที่เปิดบ่อยที่สุด เข้าถึงได้ในแตะเดียว
 * นักศึกษา: วันนี้ · กิจกรรม · แผนที่ · แจ้งเตือน · ฉัน
 * เจ้าหน้าที่กิจกรรม: แท็บ "กิจกรรม" เปลี่ยนเป็น "จัดการ" (สร้างกิจกรรม/ตรวจหลักฐาน)
 * หน้ารายละเอียด/ฟอร์มอยู่ใน Root Stack นอกแท็บ จึงมีปุ่มย้อนกลับอัตโนมัติ
 */
export default function TabsLayout() {
  const { unread } = useInbox();
  const user = useAuthenticatedSession()?.user;
  const isOrganizer = user?.role === 'organizer';
  const manages = isActivitiesStaff(user);
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        // แถบแท็บลอยเป็นแคปซูลสีเข้ม (ไม่ใช้ position absolute เนื้อหาจึงไม่ถูกบัง ไม่ต้องเผื่อที่ทุกหน้า)
        tabBarActiveTintColor: Colors.highlight,
        tabBarInactiveTintColor: '#9DB0C0',
        tabBarStyle: {
          backgroundColor: Colors.ink,
          marginHorizontal: 14,
          marginBottom: Math.max(insets.bottom, 12),
          height: 66,
          paddingTop: 8,
          paddingBottom: 8,
          borderRadius: 33,
          borderTopWidth: 0,
          elevation: 8,
          shadowColor: '#000',
          shadowOpacity: 0.18,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 },
        },
        tabBarItemStyle: { borderRadius: 26 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarBadgeStyle: { backgroundColor: Colors.danger },
        headerShadowVisible: false,
        headerStyle: { backgroundColor: Colors.background },
        headerTitleStyle: { color: Colors.text, fontWeight: '800' },
        sceneStyle: { backgroundColor: Colors.background },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'วันนี้',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="today" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="activities"
        options={{
          href: isOrganizer ? null : undefined,
          title: 'กิจกรรม',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="manage"
        options={{
          href: manages ? undefined : null,
          title: 'จัดการ',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="clipboard" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'แผนที่',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="map" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'แจ้งเตือน',
          headerShown: false,
          tabBarBadge: unread > 0 ? (unread > 99 ? '99+' : unread) : undefined,
          // ตัวเลขบน badge screen reader ไม่อ่าน จึงบอกในป้ายของแท็บด้วย
          tabBarAccessibilityLabel: unread > 0 ? `แจ้งเตือน, ยังไม่ได้อ่าน ${unread} รายการ` : 'แจ้งเตือน',
          tabBarIcon: ({ color, size }) => <Ionicons name="notifications" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'ฉัน',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="person-circle" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
