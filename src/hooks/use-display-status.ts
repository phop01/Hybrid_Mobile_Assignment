import type { DisplayStatus } from '@/components/status-badge';
import { useMyRegistrations } from '@/state/my-registrations-context';

/** สถานะที่แสดงบนการ์ด: รวมการลงทะเบียนกับคิวเช็กอินออฟไลน์ */
export function useDisplayStatus() {
  const { findActiveForActivity, queuedIds } = useMyRegistrations();
  return (activityId: string): DisplayStatus | undefined => {
    const registration = findActiveForActivity(activityId);
    if (!registration) return undefined;
    if (registration.status === 'registered' && queuedIds.includes(registration.id)) return 'queued';
    return registration.status;
  };
}
