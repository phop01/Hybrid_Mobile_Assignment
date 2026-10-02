import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import { Text } from '@/components/app-text';

/** ทับแผนที่ไว้จนกว่าจะโหลดเสร็จ ผู้ใช้จะไม่เห็นกรอบเทาว่าง ๆ แล้วคิดว่าแผนที่พัง */
export function MapLoading() {
  return (
    <View style={styles.overlay} pointerEvents="none" accessibilityLiveRegion="polite">
      <ActivityIndicator color={Colors.primary} />
      <Text style={styles.text}>กำลังโหลดแผนที่…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primarySoft,
  },
  text: { fontSize: 14, color: Colors.primaryDark },
});
