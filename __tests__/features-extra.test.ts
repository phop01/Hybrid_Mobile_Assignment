// ทดสอบฟีเจอร์เสริม: กิจกรรมใกล้ฉัน, เหรียญความสำเร็จ, แถบ 7 วัน, ข้อความแชร์
import { shareMessage } from '@/lib/activity-links';
import { summarizeAttendance } from '@/lib/attendance';
import { computeBadges } from '@/lib/badges';
import { nearestActivities } from '@/lib/nearby';
import { countByDay, weekDays } from '@/lib/week-strip';

import { makeActivity, NOW } from '../test-utils/fixtures';

describe('nearestActivities', () => {
  const near = makeActivity({ id: 'near', location: { name: 'ใกล้', latitude: 17.8047, longitude: 102.7473, radiusM: 100 } });
  const far = makeActivity({ id: 'far', location: { name: 'ไกล', latitude: 17.82, longitude: 102.77, radiusM: 100 } });
  const ended = makeActivity({ id: 'ended', startsAt: '2020-01-01T08:00:00Z', endsAt: '2020-01-01T10:00:00Z' });
  const here = { latitude: 17.8045, longitude: 102.7473 };

  it('sorts by distance, skips ended, adds walking time', () => {
    const result = nearestActivities([far, ended, near], here, 3, NOW);
    expect(result.map((r) => r.activity.id)).toEqual(['near', 'far']);
    expect(result[0].meters).toBeLessThan(50);
    expect(result[0].walkMinutes).toBe(1);
  });

  it('respects the limit', () => {
    expect(nearestActivities([far, near], here, 1, NOW)).toHaveLength(1);
  });
});

describe('computeBadges', () => {
  const base = summarizeAttendance([], []);
  const earned = (over: Partial<typeof base>) =>
    computeBadges({ ...base, ...over })
      .filter((b) => b.earned)
      .map((b) => b.id);

  it('earns nothing with no attendance', () => {
    expect(earned({})).toEqual([]);
  });

  it('earns badges from activities, hours and categories', () => {
    expect(earned({ total: 1, hours: 3, byCategory: { academic: 1, volunteer: 0, sport: 0, culture: 0 } })).toEqual(['first']);
    expect(earned({ total: 4, hours: 12, byCategory: { academic: 1, volunteer: 1, sport: 1, culture: 1 } })).toEqual([
      'first',
      'volunteer',
      'h10',
      'all-round',
    ]);
    expect(earned({ total: 9, hours: 31, byCategory: { academic: 3, volunteer: 3, sport: 2, culture: 1 } })).toEqual([
      'first',
      'volunteer',
      'h10',
      'regular',
      'all-round',
      'h30',
    ]);
  });
});

describe('week strip', () => {
  it('lists 7 days from today and counts activities per day', () => {
    const days = weekDays(new Date(2026, 9, 1, 15, 0), 7);
    expect(days).toHaveLength(7);
    expect(days[0]).toMatchObject({ key: '2026-10-01', isToday: true });
    expect(days[6].key).toBe('2026-10-07');
    const a = makeActivity({ startsAt: new Date(2026, 9, 3, 9, 0).toISOString() });
    const b = makeActivity({ id: 'b', startsAt: new Date(2026, 9, 3, 14, 0).toISOString() });
    expect(countByDay([a, b])).toEqual({ '2026-10-03': 2 });
  });
});

describe('activity links', () => {
  it('builds a share message ending with the deep link', () => {
    const message = shareMessage(makeActivity({ title: 'ปลูกป่า', hours: 3 }), 'nktoday://activities/a1');
    expect(message).toContain('ปลูกป่า');
    expect(message).toContain('ได้ 3 ชั่วโมงกิจกรรม');
    expect(message.endsWith('nktoday://activities/a1')).toBe(true);
  });

});
