import { useEffect, useRef, type ReactNode } from 'react';
import { ScrollView, type StyleProp, type ViewStyle } from 'react-native';

/**
 * แถวเลื่อนแนวนอนบนเว็บ: เมาส์ปกติเลื่อนได้แต่แนวตั้ง จึงแปลงล้อเมาส์เป็นเลื่อนซ้าย-ขวา
 * และกดลากด้วยเมาส์ได้ (ลากแล้วไม่นับเป็นการแตะชิป) · ถึงสุดขอบแล้วปล่อยให้หน้าเลื่อนต่อตามปกติ
 */
export function HScroll({ children, contentContainerStyle }: { children: ReactNode; contentContainerStyle?: StyleProp<ViewStyle> }) {
  const ref = useRef<ScrollView>(null);

  useEffect(() => {
    const node = (ref.current as unknown as { getScrollableNode?: () => HTMLElement } | null)?.getScrollableNode?.();
    if (!node) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return; // ทัชแพดปัดแนวนอนเองได้
      const max = node.scrollWidth - node.clientWidth;
      const next = Math.max(0, Math.min(max, node.scrollLeft + e.deltaY));
      if (next === node.scrollLeft) return;
      e.preventDefault();
      node.scrollLeft = next;
    };
    let startX = 0;
    let startLeft = 0;
    let dragging = false;
    let moved = false;
    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      dragging = true;
      moved = false;
      startX = e.clientX;
      startLeft = node.scrollLeft;
    };
    const onMove = (e: MouseEvent) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 5) moved = true;
      if (moved) node.scrollLeft = startLeft - dx;
    };
    const onUp = () => {
      dragging = false;
    };
    // ลากเสร็จแล้วเบราว์เซอร์จะส่ง click ตามมา กันไว้ไม่ให้กลายเป็นการกดชิป
    const onClick = (e: MouseEvent) => {
      if (!moved) return;
      e.stopPropagation();
      e.preventDefault();
      moved = false;
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    node.addEventListener('mousedown', onDown);
    node.addEventListener('click', onClick, true);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      node.removeEventListener('wheel', onWheel);
      node.removeEventListener('mousedown', onDown);
      node.removeEventListener('click', onClick, true);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  return (
    <ScrollView ref={ref} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={contentContainerStyle}>
      {children}
    </ScrollView>
  );
}
