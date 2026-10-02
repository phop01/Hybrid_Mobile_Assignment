// เว็บบนจอกว้าง (คอม/โปรเจกเตอร์ตอนนำเสนอ): แสดงแอปในกรอบมือถือกลางจอ ให้หน้าตาเหมือนบนมือถือจริง
// จอแคบ (เปิดเว็บบนมือถือ) แสดงเต็มจอเหมือนเดิม

import type { ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import { Text } from '@/components/app-text';

/** กว้างกว่านี้ถึงจะแสดงกรอบ */
const FRAME_FROM_WIDTH = 760;
const FRAME_WIDTH = 420;
const FRAME_MAX_HEIGHT = 900;
const BEZEL = 10;
/** กว้างพอจะมีชื่อแอปข้างกรอบ */
const SIDE_TEXT_FROM_WIDTH = 1000;

function useFramed(): boolean {
  return useWindowDimensions().width >= FRAME_FROM_WIDTH;
}

export function PhoneFrame({ children }: { children: ReactNode }) {
  const { width, height } = useWindowDimensions();
  if (!useFramed()) return <>{children}</>;
  const frameHeight = Math.min(FRAME_MAX_HEIGHT, height - 48);
  return (
    <View style={styles.backdrop}>
      {width >= SIDE_TEXT_FROM_WIDTH ? (
        <View style={styles.side} accessible={false}>
          <Text style={styles.brand}>KKUNK Today</Text>
          <Text style={styles.tagline}>
            ทุกเรื่องใน มข. วิทยาเขตหนองคาย{'\n'}กิจกรรม · จิตอาสา ·
            ประกาศ
          </Text>
        </View>
      ) : null}
      <View style={[styles.frame, { height: frameHeight }]}>
        <View style={styles.screen}>{children}</View>
      </View>
    </View>
  );
}

/** ความกว้างที่แอปใช้ได้จริง (ในกรอบ = ความกว้างหน้าจอในกรอบ) */
export function useAppWidth(): number {
  const { width } = useWindowDimensions();
  return width >= FRAME_FROM_WIDTH ? FRAME_WIDTH - BEZEL * 2 : width;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 64,
    backgroundColor: Colors.primaryDark,
  },
  side: { maxWidth: 320, gap: Spacing.md },
  brand: {
    fontSize: 44,
    fontWeight: '800',
    color: Colors.onPrimary,
    letterSpacing: -0.5,
  },
  tagline: { fontSize: 18, lineHeight: 28, color: Colors.onPrimaryMuted },
  frame: {
    width: FRAME_WIDTH,
    borderRadius: 44,
    padding: BEZEL,
    backgroundColor: '#111418',
    boxShadow: '0 30px 80px rgba(0, 0, 0, 0.45)',
  },
  screen: {
    flex: 1,
    borderRadius: 34,
    overflow: 'hidden',
    backgroundColor: Colors.background,
  },
});
