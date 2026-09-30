import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';

import { Colors } from '@/constants/theme';
import { isActivitiesStaff, isFacilities } from '@/lib/tickets';
import { useInbox } from '@/state/inbox-context';
import { useAuthenticatedSession } from '@/state/session-context';

/**
 * 6 แท็บ = เรื่องที่เปิดบ่อยที่สุด เข้าถึงได้ในแตะเดียว
 * นักศึกษา: วันนี้ · กิจกรรม · เรื่องแจ้ง · แผนที่ · แจ้งเตือน · ฉัน
 * เจ้าหน้าที่กิจกรรม: แท็บ "กิจกรรม" เปลี่ยนเป็น "จัดการ" (สร้างกิจกรรม/ตรวจหลักฐาน)
 * เจ้าหน้าที่อาคาร: ไม่มีแท็บกิจกรรม/จัดการ แท็บ "เรื่องแจ้ง" เป็นคิวงานซ่อม
 * หน้ารายละเอียด/ฟอร์มอยู่ใน Root Stack นอกแท็บ จึงมีปุ่มย้อนกลับอัตโนมัติ
 */
export default function TabsLayout() {
  const { unread } = useInbox();
  const user = useAuthenticatedSession()?.user;
  const isOrganizer = user?.role === 'organizer';
  // เจ้าหน้าที่กิจกรรมเห็นแท็บ "จัดการ" · เจ้าหน้าที่อาคารไม่ยุ่งกับกิจกรรม จึงไม่เห็นทั้งสองแท็บ
  const manages = isActivitiesStaff(user);
  const facilities = isFacilities(user);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        headerTitleStyle: { color: Colors.text },
        sceneStyle: { backgroundColor: Colors.background },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'วันนี้',
          headerTitle: 'KKUNK Today · วันนี้ในมอ',
          tabBarIcon: ({ color, size }) => <Ionicons name="today" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="activities"
        options={{
          href: isOrganizer ? null : undefined,
          title: 'กิจกรรม',
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="manage"
        options={{
          href: manages ? undefined : null,
          title: 'จัดการ',
          tabBarIcon: ({ color, size }) => <Ionicons name="clipboard" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="tickets"
        options={{
          title: 'เรื่องแจ้ง',
          headerTitle: facilities ? 'คิวงานแจ้งซ่อม' : isOrganizer ? 'เรื่องแจ้งในวิทยาเขต' : 'แจ้งซ่อม',
          tabBarIcon: ({ color, size }) => <Ionicons name="construct" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'แผนที่',
          tabBarIcon: ({ color, size }) => <Ionicons name="map" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'แจ้งเตือน',
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
          headerTitle: 'โปรไฟล์และชั่วโมงสะสม',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-circle" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
