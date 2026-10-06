import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { parseExifTakenAt } from '@/lib/photo-time';

const MAX_WIDTH = 960;

/**
 * ย่อรูปก่อนส่ง: รูปจากกล้องมือถือมักมีขนาดหลาย MB ส่งช้า โดยเฉพาะตอนเน็ตในงานไม่ดี
 * กว้าง 960px ยังเห็นตัวคนและบรรยากาศงานชัด
 */
export async function preparePhotoForUpload(uri: string): Promise<{ uri: string; base64: string }> {
  let base64: string | undefined;
  let resultUri = uri;
  try {
    // ไม่ส่ง height (ให้คำนวณตามสัดส่วนเอง): บนเว็บ expo-image-manipulator ตีความ height: null เป็น 0 → error "source height is zero"
    const context = ImageManipulator.manipulate(uri).resize({ width: MAX_WIDTH });
    const image = await context.renderAsync();
    const result = await image.saveAsync({ compress: 0.6, format: SaveFormat.JPEG, base64: true });
    base64 = result.base64;
    resultUri = result.uri;
  } catch {
    // ไฟล์เสีย/ไม่ใช่รูป → error ภาษาอังกฤษของ canvas ผู้ใช้อ่านไม่รู้เรื่อง
    throw new Error('ใช้รูปนี้ไม่ได้ ลองถ่ายใหม่หรือเลือกจากคลัง');
  }
  if (!base64) throw new Error('แปลงรูปไม่สำเร็จ กรุณาถ่ายใหม่');
  return { uri: resultUri, base64 };
}

/**
 * เลือกรูปปกกิจกรรมจากคลัง (สัปดาห์ 9: Image Picker)
 * ผู้จัดมักมีโปสเตอร์กิจกรรมในเครื่องอยู่แล้ว ให้ครอปเป็นแนวนอน 16:9 พอดีกับการ์ด
 * ไม่ตรวจเวลาถ่าย (ต่างจากรูปเช็กอิน) เพราะรูปปกไม่ใช่หลักฐาน คืน null ถ้าผู้ใช้กดยกเลิก
 */
export async function pickCoverImage(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [16, 9],
    quality: 1,
  });
  const asset = result.canceled ? undefined : result.assets[0];
  return asset?.uri ?? null;
}

/** เลือกรูปโปรไฟล์จากคลัง: ครอปเป็นสี่เหลี่ยมจัตุรัสให้พอดีวงกลม คืน null ถ้าผู้ใช้กดยกเลิก */
export async function pickAvatarImage(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 });
  const asset = result.canceled ? undefined : result.assets[0];
  return asset?.uri ?? null;
}

/**
 * เลือกโปสเตอร์ประกาศจากคลัง: ไม่บังคับครอป เพราะโปสเตอร์มีหลายสัดส่วน (แนวตั้ง A4 / สี่เหลี่ยม)
 * คืน null ถ้าผู้ใช้กดยกเลิก
 */
export async function pickPosterImage(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
  const asset = result.canceled ? undefined : result.assets[0];
  return asset?.uri ?? null;
}

/**
 * เปิดตัวเลือกรูปของระบบ คืนรูปที่เลือกพร้อมเวลาถ่ายจริงจาก EXIF (null = ไม่มีข้อมูลเวลา)
 * ไม่ต้องขอสิทธิ์คลังภาพ: ผู้ใช้เลือกเองทีละรูป แอปเห็นแค่รูปที่เลือก
 * คืน null ถ้าผู้ใช้กดยกเลิก
 */
export async function pickPhotoFromLibrary(): Promise<{ uri: string; takenAt: string | null } | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], exif: true, quality: 1 });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return null;
  // ใช้เวลาถ่ายจริงในรูป ไม่ใช่เวลาที่กดเลือก ไม่งั้นรูปเก่าจะผ่านการตรวจเวลา
  return { uri: asset.uri, takenAt: parseExifTakenAt(asset.exif) };
}

export type PreparedPhoto = { uri: string; base64: string };
