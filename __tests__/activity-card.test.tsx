import { fireEvent, render, screen } from '@testing-library/react-native';

import { ActivityCard } from '@/components/activity-card';

import { makeActivity } from '../test-utils/fixtures';

// ทดสอบสิ่งที่ผู้ใช้เห็นและกด ไม่ผูกกับโครงสร้างภายในของ component
describe('ActivityCard', () => {
  const activity = makeActivity({ startsAt: '2099-01-01T09:00:00+07:00', endsAt: '2099-01-01T12:00:00+07:00' });

  it('opens the activity when the card is pressed', async () => {
    const onOpen = jest.fn();
    await render(<ActivityCard activity={activity} isFavorite={false} onOpen={onOpen} onToggleFavorite={jest.fn()} />);
    await fireEvent.press(screen.getByText(activity.title));
    expect(onOpen).toHaveBeenCalledWith('a1');
  });

  it('toggles favorite through an accessible button', async () => {
    const onToggle = jest.fn();
    await render(<ActivityCard activity={activity} isFavorite={false} onOpen={jest.fn()} onToggleFavorite={onToggle} />);
    await fireEvent.press(screen.getByLabelText(`บันทึก ${activity.title} ไว้ดูทีหลัง`));
    expect(onToggle).toHaveBeenCalledWith('a1');
  });

  it('shows when an activity is full', async () => {
    await render(
      <ActivityCard
        activity={{ ...activity, registeredCount: activity.capacity }}
        isFavorite={false}
        onOpen={jest.fn()}
        onToggleFavorite={jest.fn()}
      />,
    );
    expect(screen.getByText('เต็มแล้ว')).toBeTruthy();
  });
});
