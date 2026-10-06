import { Redirect } from 'expo-router';

// รายการกิจกรรมรวมอยู่ในหน้า "วันนี้" แล้ว · เก็บเส้นทางนี้ไว้ให้ลิงก์เดิม (/activities) ยังเปิดได้
export default function ActivitiesRedirect() {
  return <Redirect href="/" />;
}
