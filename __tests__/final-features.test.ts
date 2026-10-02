// Unit tests ของฟีเจอร์ที่เพิ่มในโปรเจกต์ Final (สัปดาห์ 13)
// ชั่วโมงกิจกรรม, ฟอร์มสร้างกิจกรรมของผู้จัด, ฟอร์มสมัครสมาชิก, redirect ปลอดภัยหลัง login

import { activityHours, atTime, buildActivityInput, emptyActivityForm } from '@/lib/activity-form';
import { REQUIRED_HOURS, summarizeAttendance } from '@/lib/attendance';
import { safeNext, validateSignUp } from '@/lib/auth-validation';
import { availableReminderLeads, countdownProblem, formatCountdown, reminderTime } from '@/lib/check-in-rules';
import { isAnnouncement, isOrganizerActivity, isUser } from '@/services/validators';

import { makeActivity, makeRegistration, NOW } from '../test-utils/fixtures';

describe('ชั่วโมงกิจกรรม (summarizeAttendance)', () => {
  const activities = [
    makeActivity({ id: 'a', category: 'academic', hours: 3 }),
    makeActivity({ id: 'v', category: 'volunteer', hours: 4 }),
    makeActivity({ id: 'v2', category: 'volunteer', hours: 2.5 }),
    makeActivity({ id: 's', category: 'sport', hours: 2 }),
  ];

  it('sums hours only for checked-in activities, by category', () => {
    const summary = summarizeAttendance(
      [
        makeRegistration({ id: '1', activityId: 'a', status: 'checked_in' }),
        makeRegistration({ id: '2', activityId: 'v', status: 'checked_in' }),
        makeRegistration({ id: '3', activityId: 'v2', status: 'pending_review' }),
        makeRegistration({ id: '4', activityId: 's', status: 'registered' }),
      ],
      activities,
    );
    expect(summary.hours).toBe(7);
    expect(summary.hoursByCategory).toEqual({ academic: 3, volunteer: 4, sport: 0, culture: 0 });
    expect(summary.pendingHours).toBe(2.5);
    expect(summary.progress).toBeCloseTo(7 / REQUIRED_HOURS);
  });

  it('caps progress at 100%', () => {
    const many = Array.from({ length: 30 }, (_, i) => makeActivity({ id: `x${i}`, hours: 4 }));
    const regs = many.map((a, i) => makeRegistration({ id: String(i), activityId: a.id, status: 'checked_in' }));
    expect(summarizeAttendance(regs, many).progress).toBe(1);
  });
});

describe('ฟอร์มสร้างกิจกรรม (buildActivityInput)', () => {
  const valid = {
    ...emptyActivityForm(),
    title: 'อบรม React Native',
    description: 'ฝึกทำแอปด้วย Expo ตั้งแต่ศูนย์',
    locationName: 'ห้องปฏิบัติการ 1',
    latitude: 17.8,
    longitude: 102.7,
    dayOffset: 1,
    startTime: '09:00',
    endTime: '12:30',
  };

  it('builds API input and computes hours', () => {
    const result = buildActivityInput(valid, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.hours).toBe(3.5);
    expect(result.input.capacity).toBe(50);
    expect(new Date(result.input.endsAt).getTime() - new Date(result.input.startsAt).getTime()).toBe(3.5 * 3600_000);
  });

  it('reports every invalid field', () => {
    const result = buildActivityInput(
      { ...valid, title: 'สั้น', startTime: '9', endTime: '08:00', latitude: null, capacity: '0' },
      NOW,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual(['capacity', 'location', 'startTime', 'title']);
  });

  it('rejects an end time before the start and activities longer than 12 hours', () => {
    const before = buildActivityInput({ ...valid, startTime: '13:00', endTime: '10:00' }, NOW);
    expect(!before.ok && before.errors.endTime).toBe('เวลาจบต้องหลังเวลาเริ่ม');
    const tooLong = buildActivityInput({ ...valid, startTime: '06:00', endTime: '19:00' }, NOW);
    expect(!tooLong.ok && tooLong.errors.endTime).toMatch(/ไม่เกิน 12/);
  });

  it('parses HH:MM and rounds hours to half an hour', () => {
    expect(atTime(NOW, 0, '25:00')).toBeNull();
    const start = atTime(NOW, 0, '09:00')!;
    expect(activityHours(start, atTime(NOW, 0, '10:20')!)).toBe(1.5);
    expect(activityHours(start, atTime(NOW, 0, '09:05')!)).toBe(0.5);
  });
});

describe('สมัครสมาชิกและความปลอดภัยของ redirect', () => {
  it('validates the sign-up form', () => {
    const errors = validateSignUp({ studentId: '123', fullName: 'ก', faculty: '', password: '123', confirm: '1' });
    expect(Object.keys(errors).sort()).toEqual(['confirm', 'faculty', 'fullName', 'password', 'studentId']);
    expect(
      validateSignUp({ studentId: '6612345678', fullName: 'สมศรี ใจงาม', faculty: 'สหวิทยาการ', password: 'password1', confirm: 'password1' }),
    ).toEqual({});
  });

  it('checks the "count down from now" reminder', () => {
    const now = Date.parse('2026-10-01T09:00:00Z');
    const activity = { startsAt: '2026-10-01T10:00:00Z', endsAt: '2026-10-01T12:00:00Z' } as never;
    expect(countdownProblem(activity, 10, now)).toBeNull();
    expect(countdownProblem(activity, 3, now)).toBe('ต้องนับถอยหลังอย่างน้อย 5 วินาที');
    // ระหว่างงานยังตั้งได้ (ชวนไปส่งหลักฐาน) แต่ต้องก่อนงานจบ
    expect(countdownProblem(activity, 150 * 60, now)).toBeNull();
    expect(countdownProblem(activity, 180 * 60, now)).toBe('เวลานี้เลยเวลาจบงานแล้ว ลองลดเวลาลง');
    expect(formatCountdown(90)).toBe('1 นาที 30 วินาที');
    expect(formatCountdown(3605)).toBe('1 ชม. 5 วินาที');
  });

  it('signs up with exactly one role', () => {
    const base = { studentId: '6612345678', fullName: 'สมศรี ใจงาม', faculty: 'สหวิทยาการ', password: 'password1', confirm: 'password1' };
    expect(validateSignUp({ ...base, roles: ['activities'] })).toEqual({});
    expect(validateSignUp({ ...base, roles: ['student', 'activities'] }).roles).toBe('เลือกบทบาท 1 บทบาท');
    expect(validateSignUp({ ...base, roles: [] }).roles).toBe('เลือกบทบาท 1 บทบาท');
    const staff = validateSignUp({ ...base, studentId: '1', faculty: '', roles: ['activities'] });
    expect(staff.studentId).toBe('รหัสนักศึกษา/บุคลากรต้องเป็นตัวเลข 10 หลัก');
    expect(staff.faculty).toBe('กรุณากรอกคณะ/หน่วยงาน');
  });

  it('only allows in-app paths after login', () => {
    expect(safeNext('/activities/abc/register')).toBe('/activities/abc/register');
    expect(safeNext('https://evil.example')).toBeNull();
    expect(safeNext('//evil.example')).toBeNull();
  });
});

describe('type guard ของข้อมูลใหม่', () => {
  it('requires a known role on users', () => {
    const base = { id: 'u', studentId: '6601234567', fullName: 'ก ข', faculty: 'ค' };
    expect(isUser({ ...base, role: 'student' })).toBe(true);
    expect(isUser({ ...base, role: 'admin' })).toBe(false);
    expect(isUser(base)).toBe(false);
  });

  it('checks organizer stats', () => {
    const activity = makeActivity();
    expect(isOrganizerActivity({ ...activity, stats: { registered: 1, checkedIn: 0, pendingReview: 1 } })).toBe(true);
    expect(isOrganizerActivity({ ...activity, stats: { registered: '1' } })).toBe(false);
  });
});

describe('แจ้งเตือนล่วงหน้าที่ผู้ใช้เลือกเอง', () => {
  const activity = makeActivity(); // เริ่ม 10:15, NOW = 10:00 วันเดียวกัน

  it('คำนวณเวลาเตือนจากจำนวนนาทีก่อนงานเริ่ม', () => {
    expect(reminderTime(activity, 60).toISOString()).toBe(new Date('2026-10-01T09:15:00+07:00').toISOString());
  });

  it('ซ่อนตัวเลือกที่เลยเวลาไปแล้ว', () => {
    const early = new Date('2026-09-30T09:00:00+07:00').getTime();
    expect(availableReminderLeads(activity, early).map((l) => l.minutes)).toEqual([1440, 180, 60, 30, 15]);
    expect(availableReminderLeads(activity, new Date('2026-10-01T09:30:00+07:00').getTime()).map((l) => l.minutes)).toEqual([30, 15]);
    // เหลือ 15 นาทีก่อนงาน: ทุกตัวเลือกเลยเวลาแล้ว (ยังกำหนดเองได้ เช่น 10 นาที)
    expect(availableReminderLeads(activity, NOW)).toEqual([]);
  });
});

describe('isAnnouncement', () => {
  it('รับประกาศที่ครบทุกช่อง และปฏิเสธข้อมูลที่ผิดรูปแบบ', () => {
    expect(isAnnouncement({ id: '1', activityId: 'a', message: 'เปิดเช็กอินแล้ว', createdAt: '2026-10-01T10:00:00Z' })).toBe(true);
    expect(isAnnouncement({ id: '1', activityId: 'a', message: 5, createdAt: 'x' })).toBe(false);
    expect(isAnnouncement(null)).toBe(false);
  });
});
