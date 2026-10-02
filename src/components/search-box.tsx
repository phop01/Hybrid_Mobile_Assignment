import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Colors, MinTouch, Radius, Spacing } from '@/constants/theme';

/** ช่องค้นหามีไอคอนและปุ่มล้างคำ (clearButtonMode ใช้ได้เฉพาะ iOS จึงทำปุ่มเองให้เหมือนกันทุกแพลตฟอร์ม) */
export function SearchBox({
  value,
  onChangeText,
  placeholder,
  label,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  label: string;
}) {
  return (
    <View style={styles.box}>
      <Ionicons name="search" size={20} color={Colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        accessibilityLabel={label}
        style={styles.input}
        returnKeyType="search"
      />
      {value.length > 0 ? (
        <Pressable onPress={() => onChangeText('')} accessibilityRole="button" accessibilityLabel="ล้างคำค้นหา" hitSlop={8} style={styles.clear}>
          <Ionicons name="close-circle" size={20} color={Colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    minHeight: MinTouch + 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
  },
  input: { flex: 1, fontSize: 16, color: Colors.text, minHeight: MinTouch },
  clear: { minWidth: 28, minHeight: 28, alignItems: 'center', justifyContent: 'center' },
});
