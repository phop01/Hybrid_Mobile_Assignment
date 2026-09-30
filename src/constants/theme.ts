export const Colors = {
  // สีหลักของ NK Today: น้ำเงินแม่น้ำโขง ขาวบน primary 6.9:1
  primary: '#0F5F8C',
  primaryDark: '#0A4668',
  primarySoft: '#E3F0F7',
  background: '#F5F6FA',
  surface: '#FFFFFF',
  text: '#16182B',
  textMuted: '#5A5F73',
  border: '#E1E3EC',
  success: '#146C38', // เดิม #157F3D บนพื้น successSoft ได้ 4.47:1 ไม่ถึง 4.5 → 5.73:1
  successSoft: '#E3F5E9',
  warning: '#A15C07',
  warningSoft: '#FDF1DC',
  danger: '#B42318',
  dangerSoft: '#FDE8E6',
  star: '#A87700', // เดิม #D99A06 บนพื้นขาวได้ 2.45:1 ไอคอนต้องได้ 3:1 → 3.96:1
  // สีเน้นรอง (ประกาศจากผู้จัด, ไฮไลต์) teal บนพื้นขาว 5.36:1, บน accentSoft 4.71:1
  accent: '#0E7490',
  accentSoft: '#E0F4F8',
  // หัวข้อแบบ hero บนพื้น primary: ขาว 6.9:1, ข้อความรอง #D6E8F3 5.5:1
  onPrimary: '#FFFFFF',
  onPrimaryMuted: '#D6E8F3',
} as const;

export const Spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const Radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

/** ความกว้างสูงสุดของเนื้อหา อ่านง่ายบนจอคอม (แอปรันบนเว็บด้วย) */
export const MaxContentWidth = 960;

/** พื้นที่แตะขั้นต่ำตามแนวทาง accessibility (~44pt) */
export const MinTouch = 44;

/** จุดตั้งต้นของแผนที่: มหาวิทยาลัยขอนแก่น วิทยาเขตหนองคาย */
export const DEFAULT_CENTER = { latitude: 17.8045, longitude: 102.7473 };
