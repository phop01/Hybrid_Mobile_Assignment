// เนื้อหาแต่ละสัปดาห์อยู่ตรงไหนในแอป (แสดงในหน้า "เนื้อหาสัปดาห์ 1–14" ใช้ประกอบการนำเสนอ)

export type WeekInfo = { week: number; topic: string; where: string; files: string };

export const WEEKS: WeekInfo[] = [
  {
    week: 1,
    topic: 'Mobile, React Native, Expo และ TypeScript',
    where: 'Expo SDK 57 + TypeScript ทั้งโปรเจกต์ · npm start คำสั่งเดียวเปิดทั้ง API และแอป · type ข้อมูลทั้งหมด',
    files: 'src/types/models.ts, scripts/start.mjs',
  },
  {
    week: 2,
    topic: 'Components, Props, State และ Events',
    where: 'ActivityCard, TicketCard, StatusBadge, ปุ่มบันทึกกิจกรรม, ปุ่ม “เจอเหมือนกัน”',
    files: 'src/components/ticket-card.tsx, activity-card.tsx',
  },
  {
    week: 3,
    topic: 'Styling, Responsive UI และ Lists',
    where: 'theme สีเดียวทั้งแอป, FlatList/SectionList, หน้า Loading/Empty/Error มีปุ่มไปต่อทุกกรณี, safe area',
    files: 'src/constants/theme.ts, src/components/ui.tsx',
  },
  {
    week: 4,
    topic: 'Expo Router และ Navigation',
    where: 'แท็บแยกตามบทบาท + Stack, tickets/[id], activities/[id], deep link nktoday://tickets/<id>, +not-found',
    files: 'src/app/_layout.tsx, src/app/(tabs)/_layout.tsx',
  },
  {
    week: 5,
    topic: 'Forms และ State Management',
    where: 'ฟอร์มแจ้งเรื่อง 3 ขั้น (useReducer), ฟอร์มลงทะเบียน/สร้างกิจกรรม, Context แยกตามเรื่อง, ค้นหา/กรอง',
    files: 'src/lib/ticket-form.ts, src/state/*',
  },
  {
    week: 6,
    topic: 'REST API และ Networking',
    where: 'Node API ใน server/, type guard ทุก response, timeout + AbortController, Idempotency-Key, pull-to-refresh',
    files: 'src/services/api-client.ts, tickets-api.ts, validators.ts',
  },
  {
    week: 7,
    topic: 'Storage และ Offline-first',
    where: 'cache รายการ + เวลาอัปเดตล่าสุด (AsyncStorage), คิวเช็กอินและคิวแจ้งเรื่องตอนออฟไลน์ (SQLite) ส่งเองเมื่อมีเน็ต',
    files: 'src/storage/offline-db.ts, src/state/tickets-context.tsx',
  },
  {
    week: 8,
    topic: 'Authentication และ Security',
    where: 'Login/สมัคร, token ใน SecureStore, Stack.Protected, 401 → logout, server ตรวจบทบาท + หน่วยงานเจ้าหน้าที่ (403) และสถานะ (409), ล็อกเมื่อใส่รหัสผิด 5 ครั้ง',
    files: 'src/state/session-context.tsx, server/index.mjs',
  },
  {
    week: 9,
    topic: 'Camera, Image Picker และ Permissions',
    where: 'รูปปัญหา/รูปหลังซ่อม/รูปเช็กอิน, เลือกจากคลัง, ย่อรูป 960px, ขอสิทธิ์ตอนใช้ + ปุ่มเปิดการตั้งค่า',
    files: 'src/components/check-in-camera.tsx, photo-field.tsx',
  },
  {
    week: 10,
    topic: 'Location และ Maps',
    where: 'ปักหมุดจุดที่แจ้ง, กันแจ้งซ้ำในรัศมี 50 ม., บันทึกระยะจากจุดงานตอนส่งหลักฐาน, แผนที่รวมทุกเรื่อง, นำทางด้วยแอปแผนที่ + ดูระยะทางในแอป (ตำแหน่งสด + ระยะ/เวลาเดิน)',
    files: 'src/lib/tickets.ts, src/components/pick-map.tsx, src/app/directions.tsx',
  },
  {
    week: 11,
    topic: 'Notifications และ Deep Linking',
    where: 'กล่องแจ้งเตือนเดียว: อีกฝั่งกด → server ใส่กล่อง → แอปเด้ง · เตือนก่อนนัดซ่อม/ก่อนกิจกรรม · แตะแล้วเปิดหน้าที่ถูกต้องทุกสถานะแอป',
    files: 'src/state/inbox-context.tsx, src/services/reminders.ts',
  },
  {
    week: 12,
    topic: 'Architecture, Performance และ Accessibility',
    where: 'screen → state/hook → service/storage, logic ล้วนใน lib/, memo การ์ด, สถานะไม่ใช้สีอย่างเดียว, ปุ่ม ≥ 44pt, accessibilityLabel',
    files: 'src/lib/*, docs/QUALITY.md',
  },
  {
    week: 13,
    topic: 'Testing และ Debugging',
    where: 'Jest + Testing Library (unit, component, integration), tsc, ESLint, GitHub Actions, สคริปต์ทดสอบ API',
    files: '__tests__/*, .github/workflows/ci.yml',
  },
  {
    week: 14,
    topic: 'Build, Release และ Presentation',
    where: 'app.json (ชื่อ/ไอดี/เวอร์ชัน/ข้อความขอสิทธิ์), eas.json 3 โปรไฟล์, EXPO_PUBLIC_API_URL, release notes',
    files: 'app.json, eas.json, docs/RELEASE.md',
  },
];
