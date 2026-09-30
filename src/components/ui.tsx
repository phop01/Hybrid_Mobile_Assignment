// ชิ้นส่วน UI ที่ใช้ซ้ำทั้งแอป ปรับหน้าตาที่เดียวแล้วเปลี่ยนทุกหน้า

import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode, Ref } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ScrollViewProps,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { Colors, MaxContentWidth, MinTouch, Radius, Spacing } from '@/constants/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Screen({ children, ...props }: ScrollViewProps & { children: ReactNode }) {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      keyboardShouldPersistTaps="handled"
      {...props}>
      {children}
    </ScrollView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Text style={styles.sectionTitle} accessibilityRole="header">
      {children}
    </Text>
  );
}

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  accessibilityHint?: string;
};

export function Button({ title, onPress, variant = 'primary', icon, disabled, loading, accessibilityHint }: ButtonProps) {
  const inactive = disabled || loading;
  const fg = variant === 'primary' || variant === 'danger' ? '#FFFFFF' : variant === 'ghost' ? Colors.primary : Colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && { backgroundColor: Colors.primary },
        variant === 'danger' && { backgroundColor: Colors.danger },
        variant === 'secondary' && { backgroundColor: Colors.surface, borderColor: Colors.border, borderWidth: 1 },
        variant === 'ghost' && { backgroundColor: 'transparent' },
        pressed && { opacity: 0.8 },
        inactive && { opacity: 0.5 },
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        icon && <Ionicons name={icon} size={20} color={fg} />
      )}
      <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

export function Chip({ label, selected, onPress, color }: { label: string; selected: boolean; onPress: () => void; color?: string }) {
  const active = color ?? Colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.chip, selected && { backgroundColor: active, borderColor: active }]}>
      <Text style={[styles.chipText, selected && { color: '#FFFFFF' }]}>{label}</Text>
    </Pressable>
  );
}

export function TextField({
  label,
  error,
  hint,
  style,
  ...props
}: TextInputProps & { label: string; error?: string; hint?: string; ref?: Ref<TextInput> }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={Colors.textMuted}
        {...props}
        style={[styles.input, style, !!error && { borderColor: Colors.danger }]}
      />
      {/* error อยู่ใต้ช่องที่ผิด และประกาศให้ screen reader อ่าน */}
      {error ? (
        <Text style={styles.fieldError} accessibilityLiveRegion="polite" accessibilityRole="alert">
          {error}
        </Text>
      ) : hint ? (
        <Text style={styles.fieldHint}>{hint}</Text>
      ) : null}
    </View>
  );
}

type Tone = 'info' | 'success' | 'warning' | 'danger';
const TONES: Record<Tone, { bg: string; fg: string; icon: IconName }> = {
  info: { bg: Colors.primarySoft, fg: Colors.primaryDark, icon: 'information-circle' },
  success: { bg: Colors.successSoft, fg: Colors.success, icon: 'checkmark-circle' },
  warning: { bg: Colors.warningSoft, fg: Colors.warning, icon: 'cloud-offline' },
  danger: { bg: Colors.dangerSoft, fg: Colors.danger, icon: 'alert-circle' },
};

/** ข้อความสถานะ ใช้ทั้งไอคอน สี และข้อความ ไม่สื่อด้วยสีอย่างเดียว */
export function Banner({ tone, children, icon }: { tone: Tone; children: ReactNode; icon?: IconName }) {
  const t = TONES[tone];
  return (
    <View style={[styles.banner, { backgroundColor: t.bg }]} accessibilityRole="alert">
      <Ionicons name={icon ?? t.icon} size={20} color={t.fg} />
      <Text style={[styles.bannerText, { color: t.fg }]}>{children}</Text>
    </View>
  );
}

type StateViewProps =
  | { kind: 'loading'; message?: string }
  | { kind: 'empty' | 'error'; title: string; message?: string; actionLabel?: string; onAction?: () => void; icon?: IconName };

/** หน้าจอสถานะ Loading / Empty / Error ทุกกรณีมีข้อความ และมีทางไปต่อเมื่อทำได้ */
export function StateView(props: StateViewProps) {
  if (props.kind === 'loading') {
    return (
      <View style={styles.state} accessibilityLiveRegion="polite">
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.stateMessage}>{props.message ?? 'กำลังโหลด…'}</Text>
      </View>
    );
  }
  const icon = props.icon ?? (props.kind === 'error' ? 'cloud-offline-outline' : 'file-tray-outline');
  return (
    <View style={styles.state}>
      <Ionicons name={icon} size={48} color={props.kind === 'error' ? Colors.danger : Colors.textMuted} />
      <Text style={styles.stateTitle} accessibilityRole="header">
        {props.title}
      </Text>
      {props.message ? <Text style={styles.stateMessage}>{props.message}</Text> : null}
      {props.actionLabel && props.onAction ? (
        <View style={{ marginTop: Spacing.md, alignSelf: 'stretch' }}>
          <Button title={props.actionLabel} onPress={props.onAction} variant="secondary" />
        </View>
      ) : null}
    </View>
  );
}

export function InfoRow({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={18} color={Colors.textMuted} style={{ marginTop: 2 }} />
      <Text style={styles.infoText}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  screenContent: {
    padding: Spacing.lg,
    gap: Spacing.lg,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingBottom: Spacing.xxl,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  button: {
    minHeight: MinTouch + 4,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  buttonText: { fontSize: 16, fontWeight: '600', textAlign: 'center', flexShrink: 1 },
  chip: {
    minHeight: MinTouch, // เดิม 36 ต่ำกว่าพื้นที่แตะขั้นต่ำ 44
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
  },
  chipText: { fontSize: 14, fontWeight: '600', color: Colors.text },
  field: { gap: 6 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: Colors.text },
  input: {
    minHeight: MinTouch + 4,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 16,
    color: Colors.text,
    backgroundColor: Colors.surface,
  },
  fieldError: { color: Colors.danger, fontSize: 13 },
  fieldHint: { color: Colors.textMuted, fontSize: 13 },
  banner: { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.md, alignItems: 'flex-start' },
  bannerText: { flex: 1, fontSize: 14, lineHeight: 20 },
  state: { alignItems: 'center', justifyContent: 'center', padding: Spacing.xxl, gap: Spacing.sm },
  stateTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  stateMessage: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
  infoRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  infoText: { flex: 1, fontSize: 15, color: Colors.text, lineHeight: 22 },
});
