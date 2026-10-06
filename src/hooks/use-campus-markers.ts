import { useMemo } from 'react';

import type { MapMarker } from '@/components/pick-map';
import { CATEGORIES } from '@/lib/categories';
import { isEnded } from '@/lib/filter-activities';
import { useActivities } from '@/state/activities-context';
import { useBroadcasts } from '@/state/broadcasts-context';
import type { Activity, Broadcast } from '@/types/models';

export type MapLayer = 'all' | 'activity' | 'broadcast';

export const MAP_LAYERS: { key: MapLayer; label: string }[] = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'activity', label: 'กิจกรรม' },
  { key: 'broadcast', label: 'ประกาศ' },
];

export const BROADCAST_COLOR = '#A15C07';

export type MapSelection = { kind: 'activity'; activity: Activity } | { kind: 'broadcast'; broadcast: Broadcast } | null;

/**
 * หมุดบนแผนที่วิทยาเขต (กิจกรรมที่ยังไม่จบ + ประกาศ) ใช้ร่วมกันระหว่างแท็บแผนที่และแผนที่เต็มจอ
 * id หมุด = "a:<id>" กิจกรรม / "b:<id>" ประกาศ
 */
export function useCampusMarkers(layer: MapLayer, selectedId: string | null) {
  const { activities } = useActivities();
  const { broadcasts } = useBroadcasts();

  // useMemo จำเป็นที่นี่: แผนที่บนเว็บสร้างใหม่ทั้งแผ่นเมื่อรายการหมุดเปลี่ยน ต้องไม่เปลี่ยนทุก render
  const markers = useMemo((): MapMarker[] => {
    const show = (l: MapLayer) => layer === 'all' || layer === l;
    const list: MapMarker[] = [];
    if (show('activity')) {
      for (const a of activities.filter((x) => !isEnded(x))) {
        list.push({ id: `a:${a.id}`, ...a.location, color: CATEGORIES[a.category].color, title: a.title, subtitle: a.location.name });
      }
    }
    if (show('broadcast')) {
      for (const b of broadcasts) {
        list.push({ id: `b:${b.id}`, ...b.location, color: BROADCAST_COLOR, title: 'ประกาศ', subtitle: b.message });
      }
    }
    return list;
  }, [activities, broadcasts, layer]);

  let selection: MapSelection = null;
  if (selectedId?.startsWith('a:')) {
    const activity = activities.find((a) => a.id === selectedId.slice(2));
    if (activity) selection = { kind: 'activity', activity };
  } else if (selectedId?.startsWith('b:')) {
    const broadcast = broadcasts.find((b) => b.id === selectedId.slice(2));
    if (broadcast) selection = { kind: 'broadcast', broadcast };
  }
  return { markers, selection };
}
