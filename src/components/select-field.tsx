import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/app-text';
import { Colors, MinTouch, Radius, Spacing } from '@/constants/theme';

/**
 * ช่องเลือกจากรายการยาว: แตะแล้วกางรายการ (สูงจำกัด เลื่อนดูได้) ใต้ช่อง · เลือกแล้วหุบเอง
 * ประหยัดที่กว่าชิปหลายแถว และไม่ใช้ Modal (บนเว็บจะได้อยู่ในกรอบมือถือ)
 */
export function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder = 'แตะเพื่อเลือก',
  error,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: Spacing.sm }}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value || 'ยังไม่ได้เลือก'}`}
        accessibilityState={{ expanded: open }}
        style={[styles.field, open && styles.fieldOpen, error ? styles.fieldError : null]}>
        <Text style={[styles.value, !value && styles.placeholder]} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={Colors.textMuted} />
      </Pressable>
      {open ? (
        <View style={styles.list}>
          <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {options.map((o) => {
              const selected = o === value;
              return (
                <Pressable
                  key={o}
                  onPress={() => {
                    onChange(selected ? '' : o);
                    setOpen(false);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  style={({ pressed }) => [styles.option, selected && styles.optionOn, pressed && { opacity: 0.8 }]}>
                  <Text style={[styles.optionText, selected && styles.optionTextOn]}>{o}</Text>
                  {selected ? <Ionicons name="checkmark" size={18} color={Colors.primary} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 14, fontWeight: '600', color: Colors.text },
  field: {
    minHeight: MinTouch + 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  fieldOpen: { borderColor: Colors.primary },
  fieldError: { borderColor: Colors.danger },
  value: { flex: 1, fontSize: 16, color: Colors.text },
  placeholder: { color: Colors.textMuted },
  list: {
    maxHeight: 240,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
  },
  option: {
    minHeight: MinTouch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  optionOn: { backgroundColor: Colors.primarySoft },
  optionText: { flex: 1, fontSize: 15, color: Colors.text },
  optionTextOn: { fontWeight: '700', color: Colors.primary },
  error: { fontSize: 13, color: Colors.danger },
});
