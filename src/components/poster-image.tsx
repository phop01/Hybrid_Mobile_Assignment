import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

/**
 * รูปปก/โปสเตอร์ในกรอบที่สัดส่วนอาจไม่ตรงกับรูป (รูปที่ผู้จัดอัปโหลดมีได้ทุกสัดส่วน)
 * แสดงรูปเต็มทั้งใบไม่ถูกตัด (contain) และเติมที่ว่างสองข้างด้วยรูปเดียวกันแบบเบลอ ไม่เหลือแถบสีเปล่า
 */
export function PosterImage({ uri, style, accessibilityLabel }: { uri: string; style?: StyleProp<ViewStyle>; accessibilityLabel?: string }) {
  return (
    <View style={[styles.frame, style]}>
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        blurRadius={18}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <View style={[StyleSheet.absoluteFill, styles.dim]} />
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        transition={150}
        accessible={!!accessibilityLabel}
        accessibilityLabel={accessibilityLabel}
        accessibilityElementsHidden={!accessibilityLabel}
        importantForAccessibility={accessibilityLabel ? 'auto' : 'no'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden', backgroundColor: '#0B2436' },
  dim: { backgroundColor: 'rgba(0,0,0,0.18)' },
});
