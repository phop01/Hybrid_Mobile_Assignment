// สัปดาห์ 12: วัดก่อนปรับ (measure before optimizing)
// วัดว่ากดดาวที่การ์ดใบเดียว แล้วการ์ดในรายการ render ซ้ำกี่ใบ
// นับจาก formatDateRange ที่การ์ดเรียก 2 ครั้งต่อการ render หนึ่งครั้ง (ใน accessibilityLabel และข้อความวันที่)

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import ActivitiesScreen from '@/app/(tabs)/activities';
import { FavoritesProvider } from '@/state/favorites-context';

import { makeActivity } from '../test-utils/fixtures';

const CARD_COUNT = 10;
const mockActivities = Array.from({ length: CARD_COUNT }, (_, i) =>
  makeActivity({
    id: `a${i}`,
    title: `กิจกรรม ${i}`,
    startsAt: '2099-01-01T09:00:00+07:00',
    endsAt: '2099-01-01T12:00:00+07:00',
  }),
);

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/storage/favorites-storage', () => ({
  loadFavoriteIds: jest.fn(async () => []),
  saveFavoriteIds: jest.fn(async () => undefined),
}));
jest.mock('@/state/activities-context', () => ({
  useActivities: () => ({ activities: mockActivities, status: 'ready', error: null, offlineSince: null, refresh: jest.fn() }),
}));
jest.mock('@/state/session-context', () => ({
  useAuthenticatedSession: () => ({ token: 't', user: { id: 'u1', fullName: 'ทดสอบ ระบบ', role: 'student' } }),
}));
jest.mock('@/state/my-registrations-context', () => ({
  useMyRegistrations: () => ({ findActiveForActivity: () => undefined, queuedIds: [] }),
}));
jest.mock('@/lib/format', () => {
  const actual = jest.requireActual('@/lib/format');
  return { ...actual, formatDateRange: jest.fn(actual.formatDateRange) };
});

const { formatDateRange } = jest.requireMock('@/lib/format') as { formatDateRange: jest.Mock };
const CALLS_PER_CARD_RENDER = 2;

describe('Activities list performance', () => {
  it('re-renders only the card whose star was pressed', async () => {
    await render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
        <FavoritesProvider>
          <ActivitiesScreen />
        </FavoritesProvider>
      </SafeAreaProvider>,
    );
    await act(async () => {}); // รอโหลดรายการที่บันทึกไว้จากเครื่องเสร็จ
    formatDateRange.mockClear();

    await fireEvent.press(screen.getByLabelText('บันทึก กิจกรรม 3 ไว้ดูทีหลัง'));

    const cardRenders = formatDateRange.mock.calls.length / CALLS_PER_CARD_RENDER;
    console.log(`[perf] กดดาว 1 ใบ → การ์ด render ซ้ำ ${cardRenders} จาก ${CARD_COUNT} ใบ`);
    expect(screen.getByLabelText('นำ กิจกรรม 3 ออกจากที่บันทึกไว้')).toBeTruthy();
    expect(cardRenders).toBe(1);
  });
});
