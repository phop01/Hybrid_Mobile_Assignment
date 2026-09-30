// วงล้อเลือกตัวเลขแบบนาฬิกาจับเวลาของ iPhone: เลื่อนขึ้นลง ตัวเลขตรงกลางชัด ตัวที่ไกลออกไปจางและเล็กลง
// ใช้ได้ทั้งมือถือและเว็บ (เว็บไม่มี snapToInterval → เลื่อนเสร็จแล้วจัดให้ตรงแถวเอง)

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { Colors, Radius } from '@/constants/theme';

export const WHEEL_ITEM_HEIGHT = 36;
const VISIBLE_ROWS = 5;
const PAD = ((VISIBLE_ROWS - 1) / 2) * WHEEL_ITEM_HEIGHT;

type Props = {
  values: number[];
  value: number;
  onChange: (value: number) => void;
  /** หน่วยต่อท้ายตัวเลข เช่น "ชม." */
  unit: string;
  /** ชื่อเต็มสำหรับ screen reader เช่น "ชั่วโมง" */
  label: string;
};

export function WheelPicker({ values, value, onChange, unit, label }: Props) {
  const scrollRef = useRef<ScrollViewHandle>(null);
  const [scrollY] = useState(() => new Animated.Value(0));
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const index = Math.max(0, values.indexOf(value));

  // วางตำแหน่งเริ่มต้นตามค่าปัจจุบัน (ครั้งแรกเท่านั้น หลังจากนั้นผู้ใช้เป็นคนเลื่อน)
  const [initialIndex] = useState(index);
  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollTo({ y: initialIndex * WHEEL_ITEM_HEIGHT, animated: false }), 0);
    return () => clearTimeout(t);
  }, [initialIndex]);
  useEffect(() => () => void (settleTimer.current && clearTimeout(settleTimer.current)), []);

  const settle = (y: number) => {
    const i = Math.min(values.length - 1, Math.max(0, Math.round(y / WHEEL_ITEM_HEIGHT)));
    if (Math.abs(y - i * WHEEL_ITEM_HEIGHT) > 1) scrollRef.current?.scrollTo({ y: i * WHEEL_ITEM_HEIGHT, animated: true });
    onChange(values[i]);
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    scrollY.setValue(y);
    // เลื่อนหยุดแล้ว (ไม่มี event ใหม่สักพัก) → จัดให้ตรงแถวและเลือกค่านั้น
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => settle(y), Platform.OS === 'web' ? 120 : 80);
  };

  const step = (delta: number) => {
    const i = Math.min(values.length - 1, Math.max(0, index + delta));
    scrollRef.current?.scrollTo({ y: i * WHEEL_ITEM_HEIGHT, animated: true });
    onChange(values[i]);
  };

  return (
    <View
      style={styles.column}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: `${value} ${label}` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => step(e.nativeEvent.actionName === 'increment' ? 1 : -1)}>
      <Animated.ScrollView
        ref={scrollRef as never}
        style={styles.wheel}
        contentContainerStyle={{ paddingVertical: PAD }}
        showsVerticalScrollIndicator={false}
        snapToInterval={WHEEL_ITEM_HEIGHT}
        decelerationRate="fast"
        nestedScrollEnabled
        scrollEventThrottle={16}
        onScroll={onScroll}>
        {values.map((v, i) => {
          const center = i * WHEEL_ITEM_HEIGHT;
          const range = [center - 2 * WHEEL_ITEM_HEIGHT, center - WHEEL_ITEM_HEIGHT, center, center + WHEEL_ITEM_HEIGHT, center + 2 * WHEEL_ITEM_HEIGHT];
          const opacity = scrollY.interpolate({ inputRange: range, outputRange: [0.2, 0.45, 1, 0.45, 0.2], extrapolate: 'clamp' });
          const scale = scrollY.interpolate({ inputRange: range, outputRange: [0.8, 0.9, 1, 0.9, 0.8], extrapolate: 'clamp' });
          return (
            <Pressable key={v} onPress={() => step(i - index)} importantForAccessibility="no" accessibilityElementsHidden>
              <Animated.View style={[styles.item, { opacity, transform: [{ scale }] }]}>
                <Text style={styles.number}>{v}</Text>
              </Animated.View>
            </Pressable>
          );
        })}
      </Animated.ScrollView>
      <Text style={styles.unit} pointerEvents="none">
        {unit}
      </Text>
    </View>
  );
}

/** กรอบวงล้อหลายคอลัมน์ มีแถบไฮไลต์ตรงกลางแถวเดียวพาดทุกคอลัมน์ แบบนาฬิกาจับเวลาของ iPhone */
export function WheelGroup({ children }: { children: ReactNode }) {
  return (
    <View style={styles.group}>
      <View style={styles.highlight} pointerEvents="none" />
      {children}
    </View>
  );
}

type ScrollViewHandle = { scrollTo: (o: { y: number; animated: boolean }) => void };

const styles = StyleSheet.create({
  group: {
    flexDirection: 'row',
    justifyContent: 'center',
    height: WHEEL_ITEM_HEIGHT * VISIBLE_ROWS,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  highlight: {
    position: 'absolute',
    left: 8,
    right: 8,
    top: PAD,
    height: WHEEL_ITEM_HEIGHT,
    borderRadius: 10,
    backgroundColor: Colors.primarySoft,
  },
  column: { flex: 1, maxWidth: 110, flexDirection: 'row', alignItems: 'center' },
  wheel: { flex: 1, height: WHEEL_ITEM_HEIGHT * VISIBLE_ROWS },
  item: { height: WHEEL_ITEM_HEIGHT, alignItems: 'flex-end', justifyContent: 'center', paddingRight: 6 },
  number: { fontSize: 22, fontWeight: '600', color: Colors.text, fontVariant: ['tabular-nums'] },
  unit: { width: 44, fontSize: 15, fontWeight: '600', color: Colors.primaryDark },
});
