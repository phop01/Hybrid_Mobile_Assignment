import type { ReactNode } from 'react';
import { ScrollView, type StyleProp, type ViewStyle } from 'react-native';

/** แถวเลื่อนแนวนอน (ชิป เหรียญ โปสเตอร์) · มือถือปัดนิ้วได้อยู่แล้ว บนเว็บมีไฟล์ .web แยก */
export function HScroll({ children, contentContainerStyle }: { children: ReactNode; contentContainerStyle?: StyleProp<ViewStyle> }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={contentContainerStyle}>
      {children}
    </ScrollView>
  );
}
