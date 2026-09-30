import { summarizeAttendance } from '@/lib/attendance';
import { filterActivities, sortForBrowsing } from '@/lib/filter-activities';
import { regionFor } from '@/lib/geo';
import { hasErrors, validateRegistration } from '@/lib/validate-registration';
import { favoritesReducer, initialFavorites } from '@/state/favorites-reducer';
import { initialFormState, registrationFormReducer } from '@/state/registration-form-reducer';

import { makeActivity, makeRegistration, NOW } from '../test-utils/fixtures';

describe('filterActivities', () => {
  const list = [
    makeActivity({ id: 'a', title: 'สัมมนา Mobile Dev', category: 'academic' }),
    makeActivity({ id: 'b', title: 'ปลูกป่า', category: 'volunteer', location: { name: 'แปลงป่า', latitude: 0, longitude: 0, radiusM: 100 } }),
    makeActivity({ id: 'c', title: 'ฟุตซอล', category: 'sport' }),
  ];

  it('returns everything with no query and all categories', () => {
    expect(filterActivities(list, '', 'all')).toHaveLength(3);
  });

  it('filters by category', () => {
    expect(filterActivities(list, '', 'volunteer').map((a) => a.id)).toEqual(['b']);
  });

  it('searches title and venue, ignoring case and surrounding spaces', () => {
    expect(filterActivities(list, '  mobile ', 'all').map((a) => a.id)).toEqual(['a']);
    expect(filterActivities(list, 'แปลงป่า', 'all').map((a) => a.id)).toEqual(['b']);
  });

  it('combines query and category', () => {
    expect(filterActivities(list, 'ฟุตซอล', 'academic')).toEqual([]);
  });

  it('puts ended activities last', () => {
    const ended = makeActivity({ id: 'old', startsAt: '2026-09-01T09:00:00+07:00', endsAt: '2026-09-01T10:00:00+07:00' });
    const upcoming = makeActivity({ id: 'new' });
    expect(sortForBrowsing([ended, upcoming], NOW).map((a) => a.id)).toEqual(['new', 'old']);
  });
});

describe('validateRegistration', () => {
  const valid = { fullName: 'สมชาย ใจดี', studentId: '6601234567', faculty: 'วค.', phone: '0812345678', dietary: '' };

  it('accepts a valid form', () => {
    expect(hasErrors(validateRegistration(valid))).toBe(false);
  });

  it('reports each invalid field separately', () => {
    const errors = validateRegistration({ ...valid, studentId: '123', phone: '812345678' });
    expect(Object.keys(errors).sort()).toEqual(['phone', 'studentId']);
  });

  it('rejects a blank name', () => {
    expect(validateRegistration({ ...valid, fullName: '   ' }).fullName).toBeDefined();
  });
});

describe('favoritesReducer', () => {
  it('adds and removes the same id', () => {
    const added = favoritesReducer(initialFavorites, { type: 'toggle', id: 'a1' });
    expect(added.ids).toEqual(['a1']);
    expect(favoritesReducer(added, { type: 'toggle', id: 'a1' }).ids).toEqual([]);
  });

  it('keeps items toggled before storage finished loading', () => {
    const early = favoritesReducer(initialFavorites, { type: 'toggle', id: 'new' });
    const hydrated = favoritesReducer(early, { type: 'hydrate', ids: ['saved'] });
    expect(hydrated).toEqual({ ids: ['saved', 'new'], hydrated: true });
  });
});

describe('summarizeAttendance', () => {
  const activities = [
    makeActivity({ id: 'a', category: 'academic' }),
    makeActivity({ id: 'v', category: 'volunteer' }),
    makeActivity({ id: 's', category: 'sport' }),
  ];

  it('counts only checked-in activities', () => {
    const summary = summarizeAttendance(
      [
        makeRegistration({ id: '1', activityId: 'a', status: 'checked_in' }),
        makeRegistration({ id: '2', activityId: 'v', status: 'pending_review' }),
        makeRegistration({ id: '3', activityId: 's', status: 'registered' }),
      ],
      activities,
    );
    expect(summary.total).toBe(1);
    expect(summary.byCategory).toEqual({ academic: 1, volunteer: 0, sport: 0, culture: 0 });
    expect(summary.pendingReview).toBe(1);
  });
});

describe('registrationFormReducer', () => {
  const values = { fullName: 'a', studentId: '', faculty: '', phone: '', dietary: '' };

  it('keeps typed values after a failed submit', () => {
    let state = initialFormState(values);
    state = registrationFormReducer(state, { type: 'change', field: 'phone', value: '0812345678' });
    state = registrationFormReducer(state, { type: 'submit' });
    state = registrationFormReducer(state, { type: 'failure', message: 'เชื่อมต่อไม่ได้' });
    expect(state.phase).toBe('editing');
    expect(state.values.phone).toBe('0812345678');
    expect(state.message).toBe('เชื่อมต่อไม่ได้');
  });

  it('clears a server error once the field is edited', () => {
    let state = registrationFormReducer(initialFormState(values), {
      type: 'failure',
      message: 'ข้อมูลไม่ถูกต้อง',
      fieldErrors: { phone: 'ผิด' },
    });
    state = registrationFormReducer(state, { type: 'change', field: 'phone', value: '0' });
    expect(state.serverErrors.phone).toBeUndefined();
  });
});

describe('regionFor (แผนที่รวมกิจกรรม)', () => {
  it('returns null when there is nothing to show', () => {
    expect(regionFor([])).toBeNull();
  });

  it('centers on all points with 30% padding', () => {
    const r = regionFor([
      { latitude: 17.8, longitude: 102.7 },
      { latitude: 17.9, longitude: 102.8 },
    ])!;
    expect(r.latitude).toBeCloseTo(17.85);
    expect(r.longitude).toBeCloseTo(102.75);
    expect(r.latitudeDelta).toBeCloseTo(0.13);
  });

  it('keeps a minimum zoom for a single point', () => {
    const r = regionFor([{ latitude: 17.8066, longitude: 102.7463 }])!;
    expect(r.latitudeDelta).toBe(0.01);
    expect(r.longitudeDelta).toBe(0.01);
  });
});
