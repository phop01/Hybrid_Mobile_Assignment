// แอนิเมชันเบา ๆ ที่ใช้ซ้ำ: การ์ดค่อย ๆ โผล่ + โครงการ์ดตอนโหลด
// ใช้ Animated ของ React Native (ไม่ต้องพึ่งไลบรารีเพิ่ม) และข้ามแอนิเมชันถ้าผู้ใช้เปิด "ลดการเคลื่อนไหว"

import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';

/** ผู้ใช้ตั้งค่า "ลดการเคลื่อนไหว" ในเครื่องหรือไม่ (ยังไม่รู้ผล = false) */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => alive && setReduce(value))
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

/** เลื่อนขึ้น + จางเข้าตอนโผล่ครั้งแรก · index ทำให้การ์ดในรายการโผล่ไล่กันทีละใบ (จำกัดไม่เกิน 6 ใบแรก) */
export function FadeInView({ children, index = 0, style }: { children: ReactNode; index?: number; style?: StyleProp<ViewStyle> }) {
  const reduce = useReduceMotion();
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    // ใบที่อยู่ลึกในรายการไม่ต้องโผล่ (กันแอนิเมชันเล่นซ้ำตอนเลื่อนกลับมา)
    if (reduce || index >= 8) {
      progress.setValue(1);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 260,
      delay: Math.min(index, 6) * 50,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [index, progress, reduce]);

  return (
    <Animated.View
      style={[
        style,
        { opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] },
      ]}>
      {children}
    </Animated.View>
  );
}

/** แท่งสีเทาจาง ๆ กะพริบเบา ๆ แทนข้อมูลที่กำลังโหลด */
export function SkeletonBlock({ style }: { style?: StyleProp<ViewStyle> }) {
  const reduce = useReduceMotion();
  const [pulse] = useState(() => new Animated.Value(0.55));

  useEffect(() => {
    if (reduce) {
      pulse.setValue(0.8);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.55, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduce]);

  return <Animated.View style={[styles.block, style, { opacity: pulse }]} />;
}

/** โครงการ์ดกิจกรรมตอนโหลด (ขนาดใกล้เคียงของจริง หน้าจอจึงไม่กระโดดตอนข้อมูลมา) */
export function ActivityCardSkeleton() {
  return (
    <View style={styles.card}>
      <SkeletonBlock style={styles.cover} />
      <View style={styles.body}>
        <SkeletonBlock style={{ width: 90, height: 18, borderRadius: Radius.pill }} />
        <SkeletonBlock style={{ width: '85%', height: 20 }} />
        <SkeletonBlock style={{ width: '60%', height: 14 }} />
        <SkeletonBlock style={{ width: '45%', height: 14 }} />
      </View>
    </View>
  );
}

/** รายการโครงการ์ด: อ่านออกเสียงเป็นข้อความเดียวว่ากำลังโหลด ไม่อ่านทีละแท่ง */
export function ActivityListSkeleton({ count = 3, message = 'กำลังโหลดกิจกรรม…' }: { count?: number; message?: string }) {
  return (
    <View style={styles.list} accessible accessibilityLabel={message} accessibilityLiveRegion="polite">
      {Array.from({ length: count }, (_, i) => (
        <ActivityCardSkeleton key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: Colors.border, borderRadius: Radius.sm },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  cover: { width: '100%', aspectRatio: 16 / 9, borderRadius: 0 },
  body: { padding: Spacing.lg, gap: Spacing.sm },
  list: { gap: Spacing.md },
});
