import { useMemo } from 'react';

import type { MapMarker } from '@/components/pick-map';
import { CATEGORIES, CATEGORY_ORDER } from '@/lib/categories';
import { isEnded, type CategoryFilter } from '@/lib/filter-activities';
import { useActivities } from '@/state/activities-context';
import type { Activity } from '@/types/models';

export type MapLayer = CategoryFilter;

/** ชั้นข้อมูลบนแผนที่ = หมวดกิจกรรม */
export const MAP_LAYERS: { key: MapLayer; label: string; color?: string }[] = [
  { key: 'all', label: 'ทั้งหมด' },
  ...CATEGORY_ORDER.map((c) => ({
    key: c,
    label: CATEGORIES[c].label,
    color: CATEGORIES[c].color,
  })),
];

export type MapSelection = { kind: 'activity'; activity: Activity } | null;

/**
 * หมุดกิจกรรมที่ยังไม่จบบนแผนที่วิทยาเขต ใช้ร่วมกันระหว่างแท็บแผนที่และแผนที่เต็มจอ
 * id หมุด = "a:<id>"
 */
export function useCampusMarkers(layer: MapLayer, selectedId: string | null) {
  const { activities } = useActivities();

  // useMemo จำเป็นที่นี่: แผนที่บนเว็บสร้างใหม่ทั้งแผ่นเมื่อรายการหมุดเปลี่ยน ต้องไม่เปลี่ยนทุก render
  const markers = useMemo(
    (): MapMarker[] =>
      activities
        .filter((a) => !isEnded(a) && (layer === 'all' || a.category === layer))
        .map((a) => ({
          id: `a:${a.id}`,
          ...a.location,
          color: CATEGORIES[a.category].color,
          title: a.title,
          subtitle: a.location.name,
        })),
    [activities, layer],
  );

  let selection: MapSelection = null;
  if (selectedId?.startsWith('a:')) {
    const activity = activities.find((a) => a.id === selectedId.slice(2));
    if (activity) selection = { kind: 'activity', activity };
  }
  return { markers, selection };
}
