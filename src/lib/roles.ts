// บทบาทของบัญชี: ใช้ร่วมกันระหว่างหน้าสมัครสมาชิกและตัวเลือก "ใช้งานในฐานะ" ในแท็บ "ฉัน"

import type { IconName } from '@/components/ui';
import type { AccountRole } from '@/types/models';

export const ROLE_INFO: Record<AccountRole, { label: string; detail: string; icon: IconName; unitHint: string }> = {
  student: { label: 'นักศึกษา', detail: 'ลงทะเบียน · เช็กอิน · สะสมชั่วโมงกิจกรรม', icon: 'school', unitHint: 'เช่น คณะสหวิทยาการ' },
  activities: { label: 'เจ้าหน้าที่กิจกรรม', detail: 'สร้างกิจกรรม · ตรวจหลักฐาน · ประกาศ', icon: 'clipboard', unitHint: 'เช่น งานกิจการนักศึกษา' },
};

export const ROLE_ORDER: AccountRole[] = ['student', 'activities'];

/** บทบาททั้งหมดของผู้ใช้ (ข้อมูลเก่าที่ไม่มี roles: คิดจาก role/department) */
export function userRoles(user: { roles?: AccountRole[]; role: string; department?: 'activities' }): AccountRole[] {
  if (user.roles && user.roles.length > 0) return user.roles;
  return [user.role === 'organizer' && user.department ? user.department : 'student'];
}

export function activeRoleOf(user: { activeRole?: AccountRole; role: string; department?: 'activities' }): AccountRole {
  return user.activeRole ?? (user.role === 'organizer' && user.department ? user.department : 'student');
}

/** เจ้าหน้าที่กิจกรรม: สร้างกิจกรรม ตรวจหลักฐาน ประกาศ */
export const isActivitiesStaff = (user: { role: string; department?: 'activities' } | null | undefined) =>
  user?.role === 'organizer' && user.department === 'activities';
