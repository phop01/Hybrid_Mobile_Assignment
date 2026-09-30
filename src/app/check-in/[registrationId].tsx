import { Redirect, useLocalSearchParams } from 'expo-router';

import { firstParam } from '@/hooks/use-activity';

/**
 * หลักฐานการเข้าร่วมย้ายไปอยู่ในหน้าการลงทะเบียนแล้ว (components/evidence-card.tsx)
 * คงเส้นทางนี้ไว้เพราะแจ้งเตือนก่อนกิจกรรมที่ตั้งไว้แล้วยังชี้มาที่นี่
 */
export default function CheckInRedirect() {
  const registrationId = firstParam(useLocalSearchParams<{ registrationId?: string | string[] }>().registrationId);
  if (!registrationId) return <Redirect href="/my" />;
  return <Redirect href={{ pathname: '/registrations/[id]', params: { id: registrationId } }} />;
}
