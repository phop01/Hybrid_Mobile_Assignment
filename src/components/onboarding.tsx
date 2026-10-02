// แนะนำแอป 3 หน้า แสดงครั้งเดียวตอนเปิดแอปครั้งแรก (จำไว้ในเครื่อง ไม่ผูกกับบัญชี ไม่ถูกล้างตอน logout)
// ทำเป็นแผ่นซ้อนในกรอบแอป (ไม่ใช้ Modal) เพื่อให้บนเว็บอยู่ในกรอบมือถือ

import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/app-text';
import { Button, type IconName } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { readJson, writeJson } from '@/storage/kv';

const KEY = 'nktoday/onboarded/v1';
const isBool = (v: unknown): v is boolean => typeof v === 'boolean';

const PAGES: { icon: IconName; title: string; text: string }[] = [
  { icon: 'calendar', title: 'กิจกรรมและจิตอาสา', text: 'ค้นหา ลงทะเบียน แล้วส่งหลักฐานการเข้าร่วม เจ้าหน้าที่ตรวจผ่านแล้วชั่วโมงขึ้นในโปรไฟล์ให้เอง' },
  { icon: 'megaphone', title: 'ประกาศจากเจ้าหน้าที่', text: 'ปิดถนน ปิดน้ำ งานตลาดนัด ขึ้นบนหน้า “วันนี้” และแจ้งเตือนทุกคนทันที ไม่ต้องไล่ดูหลายกลุ่มแชต' },
  { icon: 'map', title: 'แผนที่วิทยาเขต', text: 'ดูว่ากิจกรรมอยู่ตรงไหน กดนำทางไปได้เลย หรือกด “ตำแหน่งของฉัน” เพื่อดูกิจกรรมที่ใกล้ที่สุด' },
];

export function Onboarding() {
  const [visible, setVisible] = useState(false);
  const [page, setPage] = useState(0);

  useEffect(() => {
    let alive = true;
    readJson<boolean>(KEY, isBool, false).then((done) => alive && setVisible(!done));
    return () => {
      alive = false;
    };
  }, []);

  if (!visible) return null;
  const last = page === PAGES.length - 1;
  const current = PAGES[page];

  const finish = () => {
    setVisible(false);
    writeJson(KEY, true).catch(() => undefined);
  };

  return (
    <View style={styles.overlay} accessibilityViewIsModal>
      <View style={styles.top}>
        <Pressable onPress={finish} accessibilityRole="button" accessibilityLabel="ข้ามการแนะนำ" hitSlop={12}>
          <Text style={styles.skip}>ข้าม</Text>
        </Pressable>
      </View>
      <View style={styles.center} accessibilityLiveRegion="polite">
        <View style={styles.iconWrap}>
          <Ionicons name={current.icon} size={64} color={Colors.primary} />
        </View>
        <Text style={styles.title} accessibilityRole="header">
          {current.title}
        </Text>
        <Text style={styles.text}>{current.text}</Text>
      </View>
      <View style={styles.bottom}>
        <View style={styles.dots} accessibilityLabel={`หน้า ${page + 1} จาก ${PAGES.length}`}>
          {PAGES.map((_, i) => (
            <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
          ))}
        </View>
        <Button title={last ? 'เริ่มใช้งาน' : 'ถัดไป'} icon={last ? 'checkmark' : 'arrow-forward'} onPress={() => (last ? finish() : setPage(page + 1))} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, zIndex: 100, backgroundColor: Colors.background, padding: Spacing.xl },
  top: { alignItems: 'flex-end' },
  skip: { fontSize: 16, color: Colors.textMuted, padding: Spacing.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.lg },
  iconWrap: { width: 128, height: 128, borderRadius: 64, backgroundColor: Colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 26, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  text: { fontSize: 16, color: Colors.textMuted, textAlign: 'center', lineHeight: 26 },
  bottom: { gap: Spacing.lg },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.sm },
  dot: { width: 8, height: 8, borderRadius: Radius.pill, backgroundColor: Colors.border },
  dotActive: { width: 24, backgroundColor: Colors.primary },
});
