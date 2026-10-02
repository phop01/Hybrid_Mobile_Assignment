import Ionicons from '@expo/vector-icons/Ionicons';
import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import { useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { Banner, Button, Screen, StateView } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { Text } from '@/components/app-text';

/**
 * กล้องเต็มจอสำหรับถ่ายหลักฐานการเข้าร่วม
 * แยกออกจากหน้าเช็กอิน (สัปดาห์ 12): หน้าจอไม่ต้องรู้เรื่องสิทธิ์กล้องและ CameraView เอง
 */
export function CheckInCamera({
  initialFacing,
  hint,
  onCapture,
  onClose,
  purpose = 'ถ่ายหลักฐานการเข้าร่วม',
  reason = 'รูปใช้เป็นหลักฐานว่าคุณเข้าร่วมกิจกรรมจริง แอปไม่อ่านคลังภาพเอง เห็นเฉพาะรูปที่คุณเลือกเท่านั้น',
}: {
  initialFacing: CameraType;
  hint: string;
  onCapture: (uri: string) => void;
  onClose: () => void;
  /** ใช้กล้องทำอะไร (แสดงตอนขอสิทธิ์) */
  purpose?: string;
  reason?: string;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>(initialFacing);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);

  if (!permission) return <StateView kind="loading" message="กำลังเตรียมกล้อง…" />;

  if (!permission.granted) {
    // ขอสิทธิ์ตอนผู้ใช้กดเปิดกล้อง อธิบายก่อนว่าเอาไปทำอะไร
    return (
      <Screen>
        <StateView
          kind="empty"
          icon="camera-outline"
          title={`ต้องใช้กล้องเพื่อ${purpose}`}
          message={reason}
        />
        {permission.canAskAgain ? (
          <Button title="อนุญาตให้ใช้กล้อง" icon="camera" onPress={requestPermission} />
        ) : (
          <>
            <Banner tone="danger">ปิดสิทธิ์กล้องไว้ ต้องเปิดในการตั้งค่าของเครื่องก่อน หรือกลับไปเลือกรูปจากคลังแทน</Banner>
            <Button title="เปิดการตั้งค่า" icon="settings-outline" onPress={() => Linking.openSettings()} />
          </>
        )}
        <Button title="ยกเลิก" variant="ghost" onPress={onClose} />
      </Screen>
    );
  }

  const shoot = async () => {
    if (!ready || busy || !cameraRef.current) return;
    setBusy(true);
    setError(null);
    try {
      const picture = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      if (!picture?.uri) throw new Error('ถ่ายรูปไม่สำเร็จ');
      onCapture(picture.uri);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ถ่ายรูปไม่สำเร็จ ลองใหม่');
      setBusy(false);
    }
  };

  return (
    <View style={styles.cameraWrap}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        onCameraReady={() => setReady(true)}
        onMountError={() => setError('เปิดกล้องไม่ได้ ลองปิดแอปอื่นที่ใช้กล้องแล้วลองใหม่')}
      />
      <View style={styles.cameraHint}>
        <Text style={styles.cameraHintText}>{hint}</Text>
      </View>
      {error ? (
        <View style={styles.cameraError}>
          <Banner tone="danger">{error}</Banner>
        </View>
      ) : null}
      <View style={styles.cameraBar}>
        <Pressable style={styles.roundBtn} onPress={onClose} accessibilityRole="button" accessibilityLabel="ปิดกล้อง">
          <Ionicons name="close" size={28} color="#fff" />
        </Pressable>
        <Pressable
          style={[styles.shutter, (!ready || busy) && { opacity: 0.5 }]}
          onPress={shoot}
          disabled={!ready || busy}
          accessibilityRole="button"
          accessibilityLabel="ถ่ายรูป">
          <View style={styles.shutterInner} />
        </Pressable>
        <Pressable
          style={styles.roundBtn}
          onPress={() => {
            setReady(false);
            setFacing((f) => (f === 'back' ? 'front' : 'back'));
          }}
          accessibilityRole="button"
          accessibilityLabel="สลับกล้องหน้าหลัง">
          <Ionicons name="camera-reverse" size={28} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cameraWrap: { flex: 1, backgroundColor: '#000' },
  cameraHint: {
    position: 'absolute',
    top: Spacing.lg,
    left: Spacing.lg,
    right: Spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  cameraHintText: { color: '#fff', fontSize: 15, textAlign: 'center' },
  cameraError: { position: 'absolute', top: 100, left: Spacing.lg, right: Spacing.lg },
  cameraBar: {
    position: 'absolute',
    bottom: Spacing.xxl,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  roundBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff' },
});
