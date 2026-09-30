// ทดสอบกฎของแจ้งซ่อม / กล่องแจ้งเตือน (ส่วนที่เพิ่มใน KKUNK Today)
import { fireEvent, render, screen } from '@testing-library/react-native';

import { appointmentFrom } from '@/components/appointment-picker';
import { TicketCard } from '@/components/ticket-card';
import { latestCreatedAt, mergeInbox, targetFor, unreadCount } from '@/lib/inbox';
import { initialTicketForm, ticketFormReducer, toTicketInput, validateStep, type TicketFormState } from '@/lib/ticket-form';
import { availableActions, findDuplicates, sortByUrgency, statusLabel } from '@/lib/tickets';
import { isBroadcast, isInboxItem, isTicket } from '@/services/validators';
import type { InboxItem } from '@/types/models';

import { makeTicket } from '../test-utils/fixtures';

const student = { id: 'u2', role: 'student' as const };
const reporter = { id: 'u1', role: 'student' as const };
const staff = { id: 'staff2', role: 'organizer' as const, department: 'facilities' as const };
const activitiesStaff = { id: 'org1', role: 'organizer' as const, department: 'activities' as const };

describe('availableActions (ใครกดอะไรได้)', () => {
  it('only facilities staff handle repairs; activities staff act like any reporter', () => {
    const repair = makeTicket();
    expect(availableActions(repair, activitiesStaff)).not.toContain('accept');
    expect(availableActions(repair, activitiesStaff)).not.toContain('reject');
    expect(availableActions(repair, activitiesStaff)).toContain('follow');
    expect(availableActions(repair, staff)).toEqual(expect.arrayContaining(['accept', 'reject']));
  });

  it('only staff can accept a repair; other students can follow it instead', () => {
    const repair = makeTicket();
    expect(availableActions(repair, staff)).toContain('accept');
    expect(availableActions(repair, student)).not.toContain('accept');
    expect(availableActions(repair, student)).toContain('follow');
    expect(availableActions({ ...repair, following: true }, student)).toContain('unfollow');
  });

  it('the reporter can only cancel their own open repair', () => {
    expect(availableActions(makeTicket(), reporter)).toEqual(['cancel']);
  });

  it('assignee finishes the job, reporter confirms or reopens', () => {
    const accepted = makeTicket({ status: 'accepted', assigneeId: 'staff2' });
    expect(availableActions(accepted, staff)).toEqual(expect.arrayContaining(['done', 'schedule', 'release']));
    const done = { ...accepted, status: 'done' as const };
    expect(availableActions(done, reporter)).toEqual(['confirm', 'reopen']);
    expect(availableActions(done, student)).toEqual([]);
  });

  it('closed tickets have no actions', () => {
    for (const status of ['confirmed', 'rejected', 'cancelled'] as const) {
      expect(availableActions(makeTicket({ status }), staff)).toEqual([]);
    }
  });
});

describe('findDuplicates (กันแจ้งซ้ำ)', () => {
  const here = { latitude: 17.8091, longitude: 102.7498 };
  const tickets = [
    makeTicket({ id: 'near' }),
    makeTicket({ id: 'far', location: { name: 'ไกล', latitude: 17.82, longitude: 102.76 } }),
    makeTicket({ id: 'other-category', category: 'water' }),
    makeTicket({ id: 'closed', status: 'confirmed' }),
  ];

  it('finds open repairs of the same category within 50 m only', () => {
    expect(findDuplicates(tickets, here, 'electric').map((d) => d.ticket.id)).toEqual(['near']);
  });

  it('returns nothing when the spot is new', () => {
    expect(findDuplicates(tickets, { latitude: 17.7, longitude: 102.6 }, 'electric')).toEqual([]);
  });
});

describe('priority and status', () => {
  it('puts tickets that affect more people first', () => {
    const now = Date.parse('2026-09-30T09:00:00.000Z');
    const sorted = sortByUrgency(
      [makeTicket({ id: 'quiet', category: 'cleaning' }), makeTicket({ id: 'crowded', category: 'cleaning', followerCount: 4 })],
      now,
    );
    expect(sorted[0].id).toBe('crowded');
  });

  it('describes each repair status in plain words', () => {
    expect(statusLabel({ kind: 'repair', status: 'open' })).toBe('รอเจ้าหน้าที่รับเรื่อง');
    expect(statusLabel({ kind: 'repair', status: 'confirmed' })).toBe('ซ่อมเรียบร้อย');
  });
});

describe('ticket form (useReducer)', () => {
  const filled = (overrides: Partial<TicketFormState> = {}): TicketFormState => ({
    ...initialTicketForm('repair'),
    category: 'electric',
    photo: { uri: 'file://x.jpg', base64: 'abc' },
    point: { latitude: 17.8, longitude: 102.7 },
    placeName: 'ห้อง 101',
    title: 'ปลั๊กไฟช็อต',
    ...overrides,
  });

  it('does not move to the next step until the current step is valid', () => {
    const start = initialTicketForm('repair');
    expect(ticketFormReducer(start, { type: 'next' }).step).toBe(1);
    const chosen = ticketFormReducer(start, { type: 'setCategory', category: 'water' });
    expect(ticketFormReducer(chosen, { type: 'next' }).step).toBe(2);
  });

  it('requires a photo of the problem', () => {
    expect(validateStep(filled({ photo: null }), 2).photo).toBeDefined();
    expect(validateStep(filled(), 2).photo).toBeUndefined();
  });

  it('builds the API input only when everything is valid', () => {
    expect(toTicketInput(filled({ title: 'สั้น' }))).toBeNull();
    expect(toTicketInput(filled())).toEqual({
      kind: 'repair',
      category: 'electric',
      title: 'ปลั๊กไฟช็อต',
      detail: '',
      location: { name: 'ห้อง 101', latitude: 17.8, longitude: 102.7 },
      photoBase64: 'abc',
    });
  });

  it('expands a bare room code into the building name', () => {
    const name = toTicketInput(filled({ placeName: 'NK6301' }))?.location.name ?? '';
    expect(name).toMatch(/^อาคาร.* ชั้น 3 ห้อง NK6301$/);
    // มีข้อความอื่นปนมา = ผู้ใช้เขียนเอง ไม่แก้ให้
    expect(toTicketInput(filled({ placeName: 'หน้าห้อง NK6301' }))?.location.name).toBe('หน้าห้อง NK6301');
  });
});

describe('inbox', () => {
  const item = (id: string, createdAt: string): InboxItem => ({ id, kind: 'ticket', targetId: 't1', title: id, body: '', createdAt });

  it('reports only unseen items as fresh, oldest first', () => {
    const existing = [item('a', '2026-09-30T01:00:00Z')];
    const { items, fresh } = mergeInbox(existing, [item('c', '2026-09-30T03:00:00Z'), item('b', '2026-09-30T02:00:00Z'), item('a', '2026-09-30T01:00:00Z')]);
    expect(fresh.map((i) => i.id)).toEqual(['b', 'c']);
    expect(items.map((i) => i.id)).toEqual(['c', 'b', 'a']);
    expect(latestCreatedAt(items, '')).toBe('2026-09-30T03:00:00Z');
    expect(unreadCount(items, '2026-09-30T01:30:00Z')).toBe(2);
  });

  it('routes a tap to the right screen and rejects bad ids', () => {
    expect(targetFor('ticket', 'abc-1')).toEqual({ pathname: '/tickets/[id]', params: { id: 'abc-1' } });
    expect(targetFor('manage', 'demo-paper-checkin')).toEqual({ pathname: '/organizer/[id]', params: { id: 'demo-paper-checkin' } });
    expect(targetFor('ticket', '../../etc')).toBeNull();
    expect(targetFor('unknown', 'x')).toBeNull();
  });
});

describe('validators', () => {
  it('accepts a well-formed ticket and rejects broken payloads', () => {
    expect(isTicket(makeTicket())).toBe(true);
    // เอาเรื่องขอความช่วยเหลือออกแล้ว: ข้อมูลเก่าในเครื่องที่เป็น help ต้องไม่ถูกแสดง
    expect(isTicket({ ...makeTicket(), kind: 'help', category: 'carry' })).toBe(false);
    expect(isTicket({ ...makeTicket(), status: 'lost' })).toBe(false);
    expect(isTicket({ ...makeTicket(), location: { name: 'x', latitude: 200, longitude: 0 } })).toBe(false);
    // ประกาศ: โปสเตอร์ไม่บังคับ (ข้อมูลเก่าไม่มีช่องนี้ก็ต้องผ่าน) แต่ถ้ามีต้องเป็น string
    const broadcast = {
      id: 'b1',
      message: 'ปิดน้ำ',
      location: { name: 'อครเก่า', latitude: 17.8, longitude: 102.7 },
      byId: 'staff2',
      byName: 'นายช่าง',
      createdAt: '2026-09-30T01:00:00Z',
      expiresAt: '2026-09-30T09:00:00Z',
    };
    expect(isBroadcast(broadcast)).toBe(true);
    expect(isBroadcast({ ...broadcast, imageUrl: null })).toBe(true);
    expect(isBroadcast({ ...broadcast, imageUrl: '/posters/x.jpg' })).toBe(true);
    expect(isBroadcast({ ...broadcast, imageUrl: 42 })).toBe(false);
    expect(isInboxItem({ id: '1', kind: 'ticket', targetId: 't', title: 'x', body: 'y', createdAt: 'z' })).toBe(true);
    expect(isInboxItem({ id: '1', kind: 'spam' })).toBe(false);
  });
});

describe('appointmentFrom', () => {
  it('never returns a time in the past', () => {
    const now = new Date('2026-09-30T14:00:00');
    expect(appointmentFrom(0, '09:00', now)).toBeNull();
    expect(appointmentFrom(0, '16:00', now)?.getHours()).toBe(16);
    expect(appointmentFrom(1, '09:00', now)?.getDate()).toBe(1);
  });
});

describe('TicketCard', () => {
  it('shows status in words and opens the ticket', async () => {
    const onOpen = jest.fn();
    await render(<TicketCard ticket={makeTicket({ followerCount: 2 })} onOpen={onOpen} />);
    expect(screen.getByText('รอเจ้าหน้าที่รับเรื่อง')).toBeTruthy();
    await fireEvent.press(screen.getByText('ไฟทางเดินดับ 3 ดวง'));
    expect(onOpen).toHaveBeenCalledWith('t1');
  });

  it('has an accessible label that includes place, status and followers', async () => {
    await render(<TicketCard ticket={makeTicket({ followerCount: 2 })} onOpen={jest.fn()} />);
    expect(screen.getByLabelText(/หน้าอาคารเรียนรวม.*รอเจ้าหน้าที่รับเรื่อง.*เจอเหมือนกัน 2 คน/)).toBeTruthy();
  });
});
