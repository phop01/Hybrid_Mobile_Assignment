// บทบาทของบัญชี: บัญชีหนึ่งมีได้หลายบทบาท (เช่น บุคลากรที่เรียนต่อด้วย) แต่ใช้งานทีละบทบาท
// "บทบาทที่ใช้อยู่" เก็บใน session เปลี่ยนได้ที่แท็บ "ฉัน" (POST /me/role)

export const ROLES = ['student', 'activities'];

/** บทบาททั้งหมดของบัญชี (ข้อมูลเก่าที่ยังไม่มี roles: นักศึกษา → student, เจ้าหน้าที่ → หน่วยงานของตัวเอง) */
export function rolesOf(user) {
  const valid = Array.isArray(user.roles) ? user.roles.filter((r) => ROLES.includes(r)) : [];
  if (valid.length > 0) return valid;
  return [user.role === 'organizer' ? 'activities' : 'student'];
}

/**
 * ผู้ใช้ "ในบทบาทที่ใช้อยู่": role/department ถูกตั้งตามบทบาทที่เลือก
 * โค้ดตรวจสิทธิ์ทุกจุด (requireOrganizer, requireStaff, ห้ามผู้จัดลงทะเบียน ฯลฯ) จึงใช้ได้ตรง ๆ
 * id เดิมทุกบทบาท → กฎ "ของตัวเอง" (ตรวจหลักฐานของตัวเองไม่ได้ ฯลฯ) ยังคุมทุกบทบาท
 */
export function effectiveUser(user, activeRole) {
  const roles = rolesOf(user);
  const active = roles.includes(activeRole) ? activeRole : roles[0];
  const { department: _department, ...rest } = user;
  return {
    ...rest,
    roles,
    activeRole: active,
    role: active === 'student' ? 'student' : 'organizer',
    ...(active === 'student' ? {} : { department: active }),
  };
}
