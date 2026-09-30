// ส่ง push notification ผ่าน Expo Push Service → Apple/Google → เครื่องผู้ใช้ เด้งได้แม้ปิดแอป
// (แอป poll กล่องแจ้งเตือนได้เฉพาะตอนเปิดอยู่ ปิดแอปแล้วต้องพึ่ง push)
// ฟังก์ชันล้วนแยกไว้ทดสอบได้ ส่วน sendPush ยิงเครือข่ายจริง

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
/** Expo รับได้ครั้งละไม่เกิน 100 ข้อความ */
export const PUSH_BATCH = 100;

/** token ของ Expo มีรูปแบบ ExponentPushToken[xxxx] หรือ ExpoPushToken[xxxx] */
export function isExpoPushToken(value) {
  return typeof value === 'string' && value.length <= 200 && /^Expo(nent)?PushToken\[[\w-]+\]$/.test(value);
}

/**
 * ข้อความ push จากแจ้งเตือน 1 รายการ
 * data รูปแบบเดียวกับ local notification ในแอป ({ type: 'inbox', kind, targetId }) แตะแล้วเปิดหน้าที่ถูกต้องได้เลย
 */
export function pushMessages(tokens, { kind, targetId, title, body }) {
  return tokens.map((to) => ({
    to,
    title,
    body,
    sound: 'default',
    priority: 'high',
    data: { type: 'inbox', kind, targetId },
  }));
}

export function chunk(list, size = PUSH_BATCH) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/**
 * ส่งแบบไม่รอผล (ไม่ทำให้ API ช้า) · token ที่ Expo บอกว่าเครื่องไม่ได้ลงทะเบียนแล้ว → เรียก onDeadToken ให้ลบทิ้ง
 * ไม่มีเน็ต/Expo ล่ม → แค่ log ผู้ใช้ยังเห็นแจ้งเตือนเมื่อเปิดแอป (แอป poll กล่องแจ้งเตือน)
 */
export function sendPush(messages, onDeadToken) {
  if (messages.length === 0 || process.env.PUSH_DRY_RUN === '1') return;
  for (const batch of chunk(messages)) {
    fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(batch),
    })
      .then((res) => res.json())
      .then((json) => {
        const tickets = Array.isArray(json?.data) ? json.data : [];
        tickets.forEach((ticket, i) => {
          if (ticket?.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') onDeadToken(batch[i].to);
        });
      })
      .catch((error) => console.warn('ส่ง push ไม่สำเร็จ:', error.message));
  }
}
