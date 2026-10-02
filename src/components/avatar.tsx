import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { toAbsoluteUrl } from '@/services/api-config';

/** รูปโปรไฟล์วงกลม · ยังไม่มีรูป → ตัวอักษรแรกของชื่อ (ของตกแต่ง ซ่อนจาก screen reader) */
export function Avatar({ name, url, size = 64 }: { name: string; url?: string | null; size?: number }) {
  const box = { width: size, height: size, borderRadius: size / 2 };
  if (url) {
    return (
      <Image
        source={{ uri: toAbsoluteUrl(url) }}
        style={[box, { backgroundColor: Colors.primarySoft }]}
        contentFit="cover"
        transition={150}
        accessibilityLabel={`รูปโปรไฟล์ของ ${name}`}
      />
    );
  }
  return (
    <View style={[styles.fallback, box]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Text style={[styles.initial, { fontSize: size * 0.44 }]} maxFontSizeMultiplier={1.3}>
        {name.slice(0, 1)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { backgroundColor: Colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  initial: { fontWeight: '700', color: Colors.primary },
});
