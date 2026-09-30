import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { pickPhotoFromLibrary, preparePhotoForUpload } from '@/services/photo';

import { Button } from './ui';

export type PreparedPhoto = { uri: string; base64: string };

/**
 * ช่องรูปในฟอร์ม: ถ่ายใหม่ / เลือกจากคลัง / ดูตัวอย่าง / เปลี่ยน / ลบ
 * กล้องเต็มจอเปิดโดยหน้าที่ใช้ (onOpenCamera) ช่องนี้ดูแลแค่คลังรูปและการย่อรูป
 * ยกเลิกกล้อง/ตัวเลือกรูป ข้อมูลอื่นในฟอร์มไม่หาย เพราะ state อยู่ที่หน้าฟอร์ม
 */
export function PhotoField({
  photo,
  onChange,
  onOpenCamera,
  error,
  emptyText,
}: {
  photo: PreparedPhoto | null;
  onChange: (photo: PreparedPhoto | null) => void;
  onOpenCamera: () => void;
  error?: string;
  emptyText: string;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const pick = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const picked = await pickPhotoFromLibrary();
      if (picked) onChange(await preparePhotoForUpload(picked.uri));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'ใช้รูปนี้ไม่ได้ ลองเลือกรูปอื่น');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      {photo ? (
        <Image source={{ uri: photo.uri }} style={styles.preview} contentFit="cover" accessibilityLabel="รูปที่เลือก" />
      ) : (
        <View style={[styles.preview, styles.empty, !!error && { borderColor: Colors.danger }]}>
          <Text style={styles.emptyText}>{emptyText}</Text>
        </View>
      )}
      <View style={styles.row}>
        <View style={styles.flex}>
          <Button title={photo ? 'ถ่ายใหม่' : 'ถ่ายรูป'} icon="camera" variant={photo ? 'secondary' : 'primary'} onPress={onOpenCamera} />
        </View>
        <View style={styles.flex}>
          <Button title="เลือกจากคลัง" icon="images-outline" variant="secondary" loading={busy} onPress={pick} />
        </View>
      </View>
      {photo ? <Button title="ลบรูป" icon="trash-outline" variant="ghost" onPress={() => onChange(null)} /> : null}
      {error || message ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error ?? message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm },
  // จอกว้าง (แท็บเล็ต/เว็บ) ไม่ให้รูปสูงจนดันปุ่มหลุดจอ
  preview: { width: '100%', aspectRatio: 4 / 3, maxHeight: 360, borderRadius: Radius.md, backgroundColor: Colors.border },
  empty: {
    aspectRatio: undefined,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.textMuted,
    backgroundColor: Colors.background,
    padding: Spacing.lg,
  },
  emptyText: { color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  flex: { flex: 1, minWidth: 140 },
  error: { fontSize: 13, color: Colors.danger },
});
