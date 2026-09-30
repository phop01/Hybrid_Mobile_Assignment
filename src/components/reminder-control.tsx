import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, MinTouch, Radius, Spacing } from '@/constants/theme';
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

const CUSTOM = -1;
const COUNTDOWN = -2;

/**
 * ตั้ง/เปลี่ยน/ยกเลิกแจ้งเตือนกิจกรรม: เลือกเวลาสำเร็จรูป, "กำหนดเอง" (วัน/ชม./นาที ก่อนงานเริ่ม)
 * หรือ "นับถอยหลังจากตอนนี้" (ชม./นาที/วินาที นับจากตอนกด ใช้ได้จนงานจบ เช่น ระหว่างงานให้เตือนไปส่งหลักฐาน)
 * ขอสิทธิ์แจ้งเตือนตอนกดปุ่มนี้เท่านั้น ไม่ขอตอนเปิดแอป
 * (ประกาศด่วนจากผู้จัด เช่น "เปิดเช็กอินแล้ว" เด้งให้เองโดยไม่ต้องตั้ง)
 */
export function ReminderControl({ registrationId, activity, now }: { registrationId: string; activity: Activity; now: number }) {
  const [scheduled, setScheduled] = useState<ScheduledReminder | null>(null);
  const [changing, setChanging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger' | 'info'; text: string } | null>(null);
  const [denied, setDenied] = useState(false);
  const leads = availableReminderLeads(activity, now);
  const [lead, setLead] = useState<number | null>(null);
  // ค่าเริ่มของ "กำหนดเอง": 2 ชม. ก่อนงาน
  const [custom, setCustom] = useState({ days: 0, hours: 2, minutes: 0 });
  // ค่าเริ่มของ "นับถอยหลังจากตอนนี้": 10 วินาที
  const [countdown, setCountdown] = useState({ hours: 0, minutes: 0, seconds: 10 });

  useEffect(() => {
    loadReminderMap().then((map) => setScheduled(map[registrationId] ?? null));
  }, [registrationId]);

  if (!supportsNotifications) {
    return <Banner tone="info" icon="notifications-off-outline">การแจ้งเตือนใช้ได้บนแอปมือถือ (Expo Go) เว็บเบราว์เซอร์ไม่รองรับ</Banner>;
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
              <Text style={styles.customTitle}>นับถอยหลังก่อนงานเริ่ม</Text>
              <View style={styles.steppers}>
                <Stepper label="วัน" value={custom.days} step={1} max={7} onChange={(days) => setCustom((c) => ({ ...c, days }))} />
                <Stepper label="ชั่วโมง" value={custom.hours} step={1} max={23} onChange={(hours) => setCustom((c) => ({ ...c, hours }))} />
                <Stepper label="นาที" value={custom.minutes} step={5} max={55} onChange={(minutes) => setCustom((c) => ({ ...c, minutes }))} />
              </View>
            </View>
          ) : null}

          {isCountdown ? (
            <View style={styles.custom}>
              <Text style={styles.customTitle}>นับถอยหลังจากตอนนี้</Text>
              <View style={styles.steppers}>
                <Stepper label="ชั่วโมง" value={countdown.hours} step={1} max={23} onChange={(hours) => setCountdown((c) => ({ ...c, hours }))} />
                <Stepper label="นาที" value={countdown.minutes} step={1} max={59} onChange={(minutes) => setCountdown((c) => ({ ...c, minutes }))} />
                <Stepper label="วินาที" value={countdown.seconds} step={5} max={55} onChange={(seconds) => setCountdown((c) => ({ ...c, seconds }))} />
              </View>
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
      <Text style={styles.hint}>ถ้าผู้จัดส่งประกาศ (เช่น เปิดเช็กอินแล้ว / ย้ายห้อง) จะเด้งแจ้งเตือนให้อัตโนมัติ</Text>
      {message ? <Banner tone={message.tone}>{message.text}</Banner> : null}
      {denied && Platform.OS !== 'web' ? (
        <Button title="เปิดการตั้งค่า" variant="ghost" icon="settings-outline" onPress={() => Linking.openSettings()} />
      ) : null}
    </View>
  );
}

/** ปุ่ม − ค่า + (ไม่ต้องพิมพ์ ใช้นิ้วเดียวได้ และกรอกผิดรูปแบบไม่ได้) */
function Stepper({ label, value, step, max, onChange }: { label: string; value: number; step: number; max: number; onChange: (v: number) => void }) {
  const button = (icon: 'remove' | 'add', next: number, disabled: boolean, a11y: string) => (
    <Pressable
      onPress={() => onChange(next)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.stepButton, disabled && { opacity: 0.35 }, pressed && { opacity: 0.7 }]}>
      <Ionicons name={icon} size={20} color={Colors.primary} />
    </Pressable>
  );
  return (
    <View style={styles.stepper} accessible={false}>
      <Text style={styles.stepLabel}>{label}</Text>
      <View style={styles.stepRow}>
        {button('remove', Math.max(0, value - step), value <= 0, `ลด${label}`)}
        <Text style={styles.stepValue} accessibilityLabel={`${value} ${label}`}>
          {value}
        </Text>
        {button('add', Math.min(max, value + step), value >= max, `เพิ่ม${label}`)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: 14, color: Colors.textMuted },
  hint: { fontSize: 13, color: Colors.textMuted },
  preview: { fontSize: 14, color: Colors.primaryDark, fontWeight: '600' },
  problem: { fontSize: 13, color: Colors.danger },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  flex: { flex: 1, minWidth: 140 },
  custom: { backgroundColor: Colors.primarySoft, borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.sm },
  customTitle: { fontSize: 13, fontWeight: '700', color: Colors.primaryDark },
  steppers: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, justifyContent: 'space-between' },
  stepper: { alignItems: 'center', gap: 4, minWidth: 110, flexGrow: 1 },
  stepLabel: { fontSize: 12, color: Colors.textMuted },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  stepButton: {
    width: MinTouch,
    height: MinTouch,
    borderRadius: MinTouch / 2,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: { minWidth: 28, textAlign: 'center', fontSize: 20, fontWeight: '800', color: Colors.text },
});
