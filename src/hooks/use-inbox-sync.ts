import { useEffect } from 'react';

import { isEnded } from '@/lib/filter-activities';
import { cancelReminder, loadReminderMap } from '@/services/reminders';
import { useActivities } from '@/state/activities-context';
import { useInbox } from '@/state/inbox-context';
import { useMyRegistrations } from '@/state/my-registrations-context';

/**
 * ให้หน้าจอตามทันสิ่งที่อีกฝั่งเพิ่งทำ
 * - มีแจ้งเตือนใหม่ (เช่น เจ้าหน้าที่ไม่รับการลงทะเบียน / ยกเลิก / จบกิจกรรม) → โหลดการลงทะเบียนและกิจกรรมใหม่ทันที
 *   ไม่ต้องรอดึงหน้าลงหรือสลับแอป
 * - กิจกรรมจบหรือถูกยกเลิกแล้ว → ยกเลิกเตือนที่ตั้งไว้ (เช่น "เมื่อเริ่มกิจกรรม" ของงานที่จบก่อนเวลา)
 */
export function useInboxSync() {
  const { subscribe } = useInbox();
  const { activities, refresh: refreshActivities } = useActivities();
  const { registrations, refresh: refreshRegistrations } = useMyRegistrations();

  useEffect(
    () =>
      subscribe(() => {
        refreshActivities().catch(() => undefined);
        refreshRegistrations().catch(() => undefined);
      }),
    [subscribe, refreshActivities, refreshRegistrations],
  );

  useEffect(() => {
    let stopped = false;
    loadReminderMap()
      .then(async (map) => {
        for (const r of registrations) {
          if (stopped) return;
          const activity = activities.find((a) => a.id === r.activityId);
          if (map[r.id] && activity && isEnded(activity)) await cancelReminder(r.id);
        }
      })
      .catch(() => undefined);
    return () => {
      stopped = true;
    };
  }, [activities, registrations]);
}
