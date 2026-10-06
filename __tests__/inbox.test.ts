// ทดสอบกล่องแจ้งเตือน + type guard
import { latestCreatedAt, mergeInbox, targetFor, unreadCount } from '@/lib/inbox';
import { isInboxItem } from '@/services/validators';
import type { InboxItem } from '@/types/models';

describe('inbox', () => {
  const item = (id: string, createdAt: string): InboxItem => ({ id, kind: 'activity', targetId: 'a1', title: id, body: '', createdAt });

  it('reports only unseen items as fresh, oldest first', () => {
    const existing = [item('a', '2026-09-30T01:00:00Z')];
    const { items, fresh } = mergeInbox(existing, [item('c', '2026-09-30T03:00:00Z'), item('b', '2026-09-30T02:00:00Z'), item('a', '2026-09-30T01:00:00Z')]);
    expect(fresh.map((i) => i.id)).toEqual(['b', 'c']);
    expect(items.map((i) => i.id)).toEqual(['c', 'b', 'a']);
    expect(latestCreatedAt(items, '')).toBe('2026-09-30T03:00:00Z');
    expect(unreadCount(items, '2026-09-30T01:30:00Z')).toBe(2);
  });

  it('routes a tap to the right screen and rejects bad ids', () => {
    expect(targetFor('activity', 'abc-1')).toEqual({ pathname: '/activities/[id]', params: { id: 'abc-1' } });
    expect(targetFor('manage', 'demo-paper-checkin')).toEqual({ pathname: '/organizer/[id]', params: { id: 'demo-paper-checkin' } });
    expect(targetFor('activity', '../../etc')).toBeNull();
    // เรื่องแจ้งซ่อมถูกเอาออกแล้ว: แจ้งเตือนเก่าชนิดนี้ไม่พาไปไหน
    expect(targetFor('ticket', 'abc-1')).toBeNull();
    expect(targetFor('unknown', 'x')).toBeNull();
  });
});

describe('validators', () => {
  it('accepts well-formed inbox items, rejects broken payloads', () => {
    expect(isInboxItem({ id: '1', kind: 'registration', targetId: 't', title: 'x', body: 'y', createdAt: 'z' })).toBe(true);
    // ประกาศทั่ววิทยาเขตถูกเอาออกแล้ว
    expect(isInboxItem({ id: '1', kind: 'broadcast', targetId: 't', title: 'x', body: 'y', createdAt: 'z' })).toBe(false);
    expect(isInboxItem({ id: '1', kind: 'ticket', targetId: 't', title: 'x', body: 'y', createdAt: 'z' })).toBe(false);
    expect(isInboxItem({ id: '1', kind: 'spam' })).toBe(false);
  });
});
