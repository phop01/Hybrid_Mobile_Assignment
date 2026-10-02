import type { Activity, Registration, User } from '@/types/models';

export const NOW = new Date('2026-10-01T10:00:00+07:00').getTime();

export function makeActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: 'a1',
    title: 'สัมมนา Mobile Dev',
    description: 'แลกเปลี่ยนประสบการณ์พัฒนาแอป',
    category: 'academic',
    startsAt: '2026-10-01T10:15:00+07:00',
    endsAt: '2026-10-01T12:00:00+07:00',
    location: { name: 'ห้องประชุมใหญ่', latitude: 17.8066, longitude: 102.7463, radiusM: 150 },
    checkInMethod: 'app',
    capacity: 100,
    registeredCount: 40,
    hours: 2,
    organizerId: 'org1',
    organizerName: 'อ.วิภา จัดเก่ง',
    ...overrides,
  };
}

export function makeRegistration(overrides: Partial<Registration> = {}): Registration {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    activityId: 'a1',
    status: 'registered',
    registeredAt: '2026-09-30T09:00:00+07:00',
    form: { fullName: 'สมชาย ใจดี', studentId: '6601234567', faculty: 'คณะสหวิทยาการ', phone: '0812345678', dietary: '' },
    checkIn: null,
    ...overrides,
  };
}

export const USER: User = {
  id: 'u1',
  studentId: '6601234567',
  fullName: 'สมชาย ใจดี',
  faculty: 'คณะสหวิทยาการ',
  role: 'student',
};
