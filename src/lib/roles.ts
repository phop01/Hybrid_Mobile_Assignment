// บทบาทของบัญชี: ใช้ร่วมกันระหว่างหน้าสมัครสมาชิกและตัวเลือก "ใช้งานในฐานะ" ในแท็บ "ฉัน"

import type { IconName } from '@/components/ui';
import type { AccountRole } from '@/types/models';

export const ROLE_INFO: Record<AccountRole, { label: string; detail: string; icon: IconName; unitHint: string }> = {
  student: { label: 'นักศึกษา', detail: 'แจ้งซ่อม · ลงทะเบียน · เช็กอิน', icon: 'school', unitHint: 'เช่น คณะสหวิทยาการ' },
  activities: { label: 'เจ้าหน้าที่กิจกรรม', detail: 'สร้างกิจกรรม · ตรวจหลักฐาน · ประกาศ', icon: 'clipboard', unitHint: 'เช่น งานกิจการนักศึกษา' },
  facilities: { label: 'เจ้าหน้าที่อาคาร', detail: 'รับงานซ่อม · นัดเวลา · ประกาศ', icon: 'construct', unitHint: 'เช่น งานอาคารสถานที่' },
};

export const ROLE_ORDER: AccountRole[] = ['student', 'activities', 'facilities'];

/** บทบาททั้งหมดของผู้ใช้ (ข้อมูลเก่าที่ไม่มี roles: คิดจาก role/department) */
export function userRoles(user: { roles?: AccountRole[]; role: string; department?: 'activities' | 'facilities' }): AccountRole[] {
  if (user.roles && user.roles.length > 0) return user.roles;
  return [user.role === 'organizer' && user.department ? user.department : 'student'];
}

export function activeRoleOf(user: { activeRole?: AccountRole; role: string; department?: 'activities' | 'facilities' }): AccountRole {
  return user.activeRole ?? (user.role === 'organizer' && user.department ? user.department : 'student');
}
