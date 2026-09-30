import { availableReminderLeads, canCheckIn, checkInOpensAt, customLeadProblem, formatLead } from '@/lib/check-in-rules';
import { distanceMeters } from '@/lib/geo';
import { parseExifTakenAt } from '@/lib/photo-time';

import { makeActivity, makeRegistration, NOW } from '../test-utils/fixtures';

describe('distanceMeters', () => {
  it('returns 0 for the same point', () => {
    const p = { latitude: 16.4745, longitude: 102.8232 };
    expect(distanceMeters(p, p)).toBe(0);
  });

  it('measures ~111 m for 0.001° of latitude', () => {
    const d = distanceMeters({ latitude: 16.4745, longitude: 102.8232 }, { latitude: 16.4755, longitude: 102.8232 });
    expect(d).toBeGreaterThan(105);
    expect(d).toBeLessThan(115);
  });
});

describe('canCheckIn', () => {
  const activity = makeActivity();

  it('opens 30 minutes before the start time', () => {
    expect(checkInOpensAt(activity).toISOString()).toBe(new Date('2026-10-01T09:45:00+07:00').toISOString());
  });

  it('allows sending evidence any time, without checking location (decided in chat 3)', () => {
    expect(canCheckIn(makeRegistration())).toEqual({ ok: true });
  });

  it('does not allow a second submission (evidence waiting for review)', () => {
    expect(canCheckIn(makeRegistration({ status: 'pending_review' }))).toMatchObject({ ok: false, reason: 'already_submitted' });
  });

  it('does not allow cancelled registrations', () => {
    expect(canCheckIn(makeRegistration({ status: 'cancelled' }))).toMatchObject({ ok: false, reason: 'not_registered' });
  });
});

describe('parseExifTakenAt', () => {
  it('uses OffsetTimeOriginal when present', () => {
    expect(parseExifTakenAt({ DateTimeOriginal: '2026:10:01 10:15:30', OffsetTimeOriginal: '+07:00' })).toBe(
      '2026-10-01T03:15:30.000Z',
    );
  });

  it('falls back to device local time without an offset', () => {
    expect(parseExifTakenAt({ DateTimeOriginal: '2026:10:01 10:15:30' })).toBe(
      new Date(2026, 9, 1, 10, 15, 30).toISOString(),
    );
  });

  it('returns null when there is no capture time', () => {
    expect(parseExifTakenAt({})).toBeNull();
    expect(parseExifTakenAt(undefined)).toBeNull();
    expect(parseExifTakenAt({ DateTimeOriginal: 'not a date' })).toBeNull();
  });
});

describe('reminder lead (ตั้งเวลาเตือนก่อนกิจกรรม)', () => {
  // งานเริ่มอีก 5 ชั่วโมงจาก NOW
  const activity = makeActivity({ startsAt: new Date(NOW + 5 * 3600e3).toISOString(), endsAt: new Date(NOW + 7 * 3600e3).toISOString() });

  it('formats a countdown in days, hours and minutes', () => {
    expect(formatLead(150)).toBe('2 ชม. 30 นาที');
    expect(formatLead(24 * 60 + 60)).toBe('1 วัน 1 ชม.');
    expect(formatLead(15)).toBe('15 นาที');
  });

  it('hides presets that are already in the past', () => {
    const minutes = availableReminderLeads(activity, NOW).map((l) => l.minutes);
    expect(minutes).toEqual([180, 60, 30, 15]);
  });

  it('accepts a custom lead only if the reminder is still in the future', () => {
    expect(customLeadProblem(activity, 4 * 60 + 55, NOW)).toBeNull();
    expect(customLeadProblem(activity, 5 * 60, NOW)).toMatch(/ผ่านไปแล้ว/);
    expect(customLeadProblem(activity, 0, NOW)).toMatch(/อย่างน้อย 1 นาที/);
    expect(customLeadProblem(activity, 8 * 24 * 60, NOW)).toMatch(/7 วัน/);
  });
});
