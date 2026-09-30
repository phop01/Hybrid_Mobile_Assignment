import { useEffect, useState } from 'react';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import { availableReminderLeads, countdownProblem, customLeadProblem, formatCountdown, formatLead, reminderTime } from '@/lib/check-in-rules';
import { formatDate, formatTime } from '@/lib/format';
import {
  cancelReminder,
  loadReminderMap,
  scheduleCheckInReminder,
  supportsNotifications,
  type ScheduledReminder,
} from '@/services/reminders';
import type { Activity } from '@/types/models';

import { Banner, Button, Chip } from './ui';
import { WheelGroup, WheelPicker } from './wheel-picker';

const CUSTOM = -1;
const COUNTDOWN = -2;

/**
 * ตั้ง/เปลี่ยน/ยกเลิกแจ้งเตือนกิจกรรม: เลือกเวลาสำเร็จรูป, "กำหนดเอง" (วัน/ชม./นาที ก่อนงานเริ่ม)
 * หรือ "นับถอยหลังจากตอนนี้" (ชม./นาที/วินาที นับจากตอนกด ใช้ได้จนงานจบ เช่น ระหว่างงานให้เตือนไปส่งหลักฐาน)
 * ขอสิทธิ์แจ้งเตือนตอนกดปุ่มนี้เท่านั้น ไม่ขอตอนเปิดแอป
 * (ประกาศด่วนจากผู้จัด เช่น "เริ่มกิจกรรมแล้ว" เด้งให้เองโดยไม่ต้องตั้ง)
 */
export function ReminderControl({
  registrationId,
  activity,
  now,
  preferCountdown = false,
}: {
  registrationId: string;
  activity: Activity;
  now: number;
  /** เปิดมาเลือก "นับถอยหลังจากตอนนี้" ไว้ก่อน (หน้าลงทะเบียนสำเร็จ: เตือนให้ไปเช็กอิน) */
  preferCountdown?: boolean;
}) {
  const [scheduled, setScheduled] = useState<ScheduledReminder | null>(null);
  const [changing, setChanging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger' | 'info'; text: string } | null>(null);
  const [denied, setDenied] = useState(false);
  const leads = availableReminderLeads(activity, now);
  const [lead, setLead] = useState<number | null>(preferCountdown ? COUNTDOWN : null);
  // ค่าเริ่มของ "กำหนดเอง": 2 ชม. ก่อนงาน
  const [custom, setCustom] = useState({ days: 0, hours: 2, minutes: 0 });
  // ค่าเริ่มของ "นับถอยหลังจากตอนนี้": 5 วินาที (ขั้นต่ำ)
  const [countdown, setCountdown] = useState({ hours: 0, minutes: 0, seconds: 5 });

  useEffect(() => {
    loadReminderMap().then((map) => setScheduled(map[registrationId] ?? null));
  }, [registrationId]);

  // ถึงเวลาเตือนแล้ว → กลับไปหน้าตั้งเตือนทันที (ตั้งรอบใหม่ได้เลย ไม่ต้องรอนาฬิกาในหน้าอัปเดต)
  const scheduledAt = scheduled?.at;
  useEffect(() => {
    if (!scheduledAt) return;
    const timer = setTimeout(() => setScheduled(null), Math.max(0, new Date(scheduledAt).getTime() - Date.now()) + 500);
    return () => clearTimeout(timer);
  }, [scheduledAt]);

  if (!supportsNotifications) {
    return <Banner tone="info" icon="notifications-off-outline">เบราว์เซอร์นี้ไม่มีแจ้งเตือนของระบบ ใช้แอปมือถือ (Expo Go) แทน</Banner>;
  }

  const eventStarted = new Date(activity.startsAt).getTime() <= now;
  const eventEnded = new Date(activity.endsAt).getTime() <= now;
  const customMinutes = custom.days * 24 * 60 + custom.hours * 60 + custom.minutes;
  const countdownSeconds = countdown.hours * 3600 + countdown.minutes * 60 + countdown.seconds;
  // ยังไม่ได้เลือก → ใช้ตัวเลือกสำเร็จรูปที่ใกล้งานที่สุดที่ยังทัน · ไม่มีเหลือแล้ว → กำหนดเอง · งานเริ่มแล้ว → นับถอยหลัง
  const selected = eventStarted ? COUNTDOWN : (lead ?? leads[leads.length - 1]?.minutes ?? CUSTOM);
  const isCountdown = selected === COUNTDOWN;
  const leadMinutes = selected === CUSTOM ? customMinutes : selected;
  const problem = isCountdown
    ? countdownProblem(activity, countdownSeconds, now)
    : selected === CUSTOM
      ? customLeadProblem(activity, customMinutes, now)
      : null;
  const at = isCountdown ? new Date(now + countdownSeconds * 1000) : reminderTime(activity, leadMinutes);
  // นับถอยหลังนับจากตอนกดจริง ไม่ใช่จากเวลาที่หน้าจอ render ล่าสุด
  const reminderDate = () => (isCountdown ? new Date(Date.now() + countdownSeconds * 1000) : reminderTime(activity, leadMinutes));

  const run = async (task: () => Promise<ScheduledReminder | null>, successText: string) => {
    setBusy(true);
    setMessage(null);
    setDenied(false);
    try {
      setScheduled(await task());
      setChanging(false);
      setMessage({ tone: 'success', text: successText });
    } catch (e) {
      const code = e instanceof Error ? e.message : '';
      if (code === 'notification-permission-denied') {
        setDenied(true);
        setMessage({ tone: 'danger', text: 'ไม่ได้รับสิทธิ์แจ้งเตือน เปิดสิทธิ์ได้ในการตั้งค่าของเครื่อง' });
      } else if (code === 'reminder-time-has-passed') {
        setMessage({ tone: 'info', text: 'เลยเวลาที่เลือกไปแล้ว ลองเลือกเวลาอื่น' });
      } else {
        setMessage({ tone: 'danger', text: 'ตั้งแจ้งเตือนไม่สำเร็จ' });
      }
    } finally {
      setBusy(false);
    }
  };

  const scheduledInFuture = scheduled && new Date(scheduled.at).getTime() > now;
  const scheduledLead = scheduled ? Math.round((new Date(activity.startsAt).getTime() - new Date(scheduled.at).getTime()) / 60000) : 0;

  return (
    <View style={{ gap: Spacing.sm }}>
      {scheduledInFuture && !changing ? (
        <>
          <Text style={styles.text}>
            จะแจ้งเตือน {formatDate(scheduled.at)} เวลา {formatTime(scheduled.at)} ·{' '}
            {scheduledLead > 0 ? `ก่อนงาน ${formatLead(scheduledLead)}` : 'ระหว่างงาน'}
          </Text>
          <View style={styles.row}>
            <View style={styles.flex}>
              <Button title="เปลี่ยนเวลา" icon="time-outline" variant="secondary" onPress={() => setChanging(true)} />
            </View>
            <View style={styles.flex}>
              <Button
                title="ยกเลิกแจ้งเตือน"
                icon="notifications-off-outline"
                variant="ghost"
                loading={busy}
                onPress={() => run(async () => (await cancelReminder(registrationId), null), 'ยกเลิกแจ้งเตือนแล้ว')}
              />
            </View>
          </View>
        </>
      ) : eventEnded ? null : (
        <>
          <Text style={styles.text}>{eventStarted ? 'กิจกรรมเริ่มแล้ว เตือนฉันไปเช็กอิน' : 'เตือนฉันก่อนกิจกรรม'}</Text>
          <View style={styles.row}>
            {eventStarted ? null : (
              <>
                {leads.map((l) => (
                  <Chip key={l.minutes} label={l.label} selected={l.minutes === selected} onPress={() => setLead(l.minutes)} />
                ))}
                <Chip label="กำหนดเอง" selected={selected === CUSTOM} onPress={() => setLead(CUSTOM)} />
              </>
            )}
            <Chip label="นับถอยหลังจากตอนนี้" selected={isCountdown} onPress={() => setLead(COUNTDOWN)} />
          </View>

          {selected === CUSTOM ? (
            <View style={styles.custom}>
              <Text style={styles.customTitle}>ก่อนงานเริ่ม</Text>
              <WheelGroup>
                <WheelPicker label="วัน" unit="วัน" values={range(0, 7)} value={custom.days} onChange={(days) => setCustom((c) => ({ ...c, days }))} />
                <WheelPicker label="ชั่วโมง" unit="ชม." values={range(0, 23)} value={custom.hours} onChange={(hours) => setCustom((c) => ({ ...c, hours }))} />
                <WheelPicker label="นาที" unit="นาที" values={range(0, 55, 5)} value={custom.minutes} onChange={(minutes) => setCustom((c) => ({ ...c, minutes }))} />
              </WheelGroup>
            </View>
          ) : null}

          {isCountdown ? (
            <View style={styles.custom}>
              <WheelGroup>
                <WheelPicker label="ชั่วโมง" unit="ชม." values={range(0, 23)} value={countdown.hours} onChange={(hours) => setCountdown((c) => ({ ...c, hours }))} />
                <WheelPicker label="นาที" unit="นาที" values={range(0, 59)} value={countdown.minutes} onChange={(minutes) => setCountdown((c) => ({ ...c, minutes }))} />
                <WheelPicker label="วินาที" unit="วิ." values={range(0, 59)} value={countdown.seconds} onChange={(seconds) => setCountdown((c) => ({ ...c, seconds }))} />
              </WheelGroup>
            </View>
          ) : null}

          {problem ? (
            <Text style={styles.problem} accessibilityRole="alert">
              {problem}
            </Text>
          ) : (
            <Text style={styles.preview}>
              จะเตือน {formatDate(at.toISOString())} เวลา {formatTime(at.toISOString())} ·{' '}
              {isCountdown ? `อีก ${formatCountdown(countdownSeconds)} จากตอนนี้` : `ก่อนงาน ${formatLead(leadMinutes)}`}
            </Text>
          )}
          <Button
            title={isCountdown ? `ตั้งแจ้งเตือน (อีก ${formatCountdown(countdownSeconds)})` : `ตั้งแจ้งเตือน (ก่อน ${formatLead(leadMinutes)})`}
            icon="notifications-outline"
            variant="secondary"
            loading={busy}
            disabled={!!problem}
            onPress={() => run(() => scheduleCheckInReminder(registrationId, activity, reminderDate()), 'ตั้งแจ้งเตือนแล้ว')}
          />
          {changing ? <Button title="ไม่เปลี่ยน" variant="ghost" onPress={() => setChanging(false)} /> : null}
        </>
      )}
      {Platform.OS === 'web' ? <Text style={styles.hint}>บนเว็บต้องเปิดแท็บนี้ค้างไว้จนถึงเวลาเตือน</Text> : null}
      <Text style={styles.hint}>ถ้าผู้จัดส่งประกาศ (เช่น เริ่มกิจกรรมแล้ว / ย้ายห้อง) จะเด้งแจ้งเตือนให้อัตโนมัติ</Text>
      {message ? <Banner tone={message.tone}>{message.text}</Banner> : null}
      {denied && Platform.OS !== 'web' ? (
        <Button title="เปิดการตั้งค่า" variant="ghost" icon="settings-outline" onPress={() => Linking.openSettings()} />
      ) : null}
    </View>
  );
}

/** ตัวเลข from..to (รวมปลายทั้งสองข้าง) ทีละ step */
function range(from: number, to: number, step = 1): number[] {
  return Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);
}

const styles = StyleSheet.create({
  text: { fontSize: 14, color: Colors.textMuted },
  hint: { fontSize: 13, color: Colors.textMuted },
  preview: { fontSize: 14, color: Colors.primaryDark, fontWeight: '600' },
  problem: { fontSize: 13, color: Colors.danger },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  flex: { flex: 1, minWidth: 140 },
  custom: { gap: Spacing.xs },
  customTitle: { fontSize: 13, fontWeight: '700', color: Colors.primaryDark },
});
