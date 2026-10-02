import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';

const TICKS = 40;
const TICK_W = 5;
const TICK_H = 12;

/**
 * วงแหวนความคืบหน้า (0–1) ทำจากขีดเรียงรอบวง ไม่ต้องพึ่งไลบรารีวาดภาพ
 * ขีดที่ถึงแล้วสีขาว ที่เหลือสีเข้ม · ตัวเลขตรงกลางเป็นของตกแต่ง ความหมายอยู่ที่ข้อความของผู้เรียก
 */
export function ProgressRing({ progress, size = 112, label }: { progress: number; size?: number; label: string }) {
  const filled = Math.round(Math.min(1, Math.max(0, progress)) * TICKS);
  const radius = size / 2 - TICK_H / 2;
  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: TICKS }, (_, i) => (
        <View
          key={i}
          style={[
            styles.tick,
            {
              left: size / 2 - TICK_W / 2,
              top: size / 2 - TICK_H / 2,
              backgroundColor: i < filled ? Colors.onPrimary : Colors.primaryDark,
              transform: [{ rotate: `${(i * 360) / TICKS}deg` }, { translateY: -radius }],
            },
          ]}
        />
      ))}
      <View style={styles.center}>
        <Text style={styles.percent} maxFontSizeMultiplier={1.2}>
          {Math.round(progress * 100)}%
        </Text>
        <Text style={styles.label} maxFontSizeMultiplier={1.2}>
          {label}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tick: { position: 'absolute', width: TICK_W, height: TICK_H, borderRadius: TICK_W / 2 },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  percent: { fontSize: 24, fontWeight: '800', color: Colors.onPrimary },
  label: { fontSize: 11, color: Colors.onPrimaryMuted },
});
