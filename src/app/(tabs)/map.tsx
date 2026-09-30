import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ActivityCard } from '@/components/activity-card';
import { BroadcastCard } from '@/components/broadcast-card';
import { PickMap, type MapMarker } from '@/components/pick-map';
import { TicketCard } from '@/components/ticket-card';
import { ChipBar, OfflineBanner, StateView } from '@/components/ui';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useDisplayStatus } from '@/hooks/use-display-status';
import { CATEGORIES } from '@/lib/categories';
import { isEnded } from '@/lib/filter-activities';
import { isActive, KIND_INFO } from '@/lib/tickets';
import { useActivities } from '@/state/activities-context';
import { useFavorites } from '@/state/favorites-context';
import { useTickets } from '@/state/tickets-context';

type Layer = 'all' | 'activity' | 'repair' | 'broadcast';

const LAYERS: { key: Layer; label: string }[] = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'activity', label: 'กิจกรรม' },
  { key: 'repair', label: 'แจ้งซ่อม' },
  { key: 'broadcast', label: 'ประกาศ' },
];

const BROADCAST_COLOR = '#A15C07';

/**
 * แผนที่รวมทุกเรื่องในวิทยาเขต: กิจกรรมที่ยังไม่จบ, เรื่องแจ้งซ่อมที่ยังไม่ปิด และประกาศ
 * แตะหมุด → การ์ดด้านล่าง → แตะการ์ดเพื่อดูรายละเอียด
 * ไม่ขอสิทธิ์ตำแหน่ง: แค่ดูว่าเรื่องอยู่ตรงไหน ยังไม่ได้ใช้ตำแหน่งผู้ใช้
 */
export default function MapScreen() {
  const { activities, status, error, offlineSince, refresh } = useActivities();
  const { tickets, broadcasts } = useTickets();
  const { isFavorite, toggleFavorite } = useFavorites();
  const statusOf = useDisplayStatus();
  const [layer, setLayer] = useState<Layer>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // useMemo จำเป็นที่นี่: แผนที่บนเว็บสร้างใหม่ทั้งแผ่นเมื่อรายการหมุดเปลี่ยน ต้องไม่เปลี่ยนทุก render
  const markers = useMemo((): MapMarker[] => {
    const show = (l: Layer) => layer === 'all' || layer === l;
    const list: MapMarker[] = [];
    if (show('activity')) {
      for (const a of activities.filter((x) => !isEnded(x))) {
        list.push({ id: `a:${a.id}`, ...a.location, color: CATEGORIES[a.category].color, title: a.title, subtitle: a.location.name });
      }
    }
    for (const t of tickets.filter(isActive)) {
      if (!show(t.kind)) continue;
      list.push({ id: `t:${t.id}`, ...t.location, color: KIND_INFO[t.kind].color, title: t.title, subtitle: KIND_INFO[t.kind].label });
    }
    if (show('broadcast')) {
      for (const b of broadcasts) {
        list.push({ id: `b:${b.id}`, ...b.location, color: BROADCAST_COLOR, title: 'ประกาศ', subtitle: b.message });
      }
    }
    return list;
  }, [activities, broadcasts, layer, tickets]);

  const onSelect = useCallback((id: string | null) => setSelectedId(id), []);
  const [type, rawId] = selectedId ? [selectedId.slice(0, 1), selectedId.slice(2)] : [null, null];
  const activity = type === 'a' ? activities.find((a) => a.id === rawId) : undefined;
  const ticket = type === 't' ? tickets.find((t) => t.id === rawId) : undefined;
  const broadcast = type === 'b' ? broadcasts.find((b) => b.id === rawId) : undefined;

  if (status === 'loading') return <StateView kind="loading" message="กำลังโหลดแผนที่…" />;
  if (status === 'error' && activities.length === 0) {
    return <StateView kind="error" title="โหลดข้อมูลไม่สำเร็จ" message={error ?? undefined} actionLabel="ลองใหม่" onAction={refresh} />;
  }

  return (
    <View style={styles.screen}>
      <View style={styles.top}>
        <ChipBar
          options={LAYERS}
          value={layer}
          onChange={(key) => {
            setLayer(key);
            setSelectedId(null);
          }}
        />
        <OfflineBanner since={offlineSince} />
      </View>

      <View style={styles.map}>
        {markers.length > 0 ? (
          <PickMap
            markers={markers}
            selectedId={selectedId}
            onSelectMarker={onSelect}
            accessibilityLabel={`แผนที่วิทยาเขต ${markers.length} จุด`}
          />
        ) : (
          <StateView kind="empty" icon="map-outline" title="ไม่มีเรื่องในหมวดนี้บนแผนที่" />
        )}
      </View>

      <View style={styles.bottom}>
        {activity ? (
          <ActivityCard
            activity={activity}
            isFavorite={isFavorite(activity.id)}
            status={statusOf(activity.id)}
            onOpen={(id) => router.push({ pathname: '/activities/[id]', params: { id } })}
            onToggleFavorite={toggleFavorite}
          />
        ) : ticket ? (
          <TicketCard ticket={ticket} onOpen={(id) => router.push({ pathname: '/tickets/[id]', params: { id } })} />
        ) : broadcast ? (
          <BroadcastCard broadcast={broadcast} compact />
        ) : (
          // แผนที่ใช้กับ screen reader ได้ยาก จึงบอกทางเลือกที่เป็นรายการไว้ด้วย
          <Text style={styles.hint}>แตะหมุดเพื่อดูรายละเอียด · {markers.length} จุด · ดูแบบรายการได้ที่แท็บกิจกรรม/เรื่องแจ้ง</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  top: { padding: Spacing.md, gap: Spacing.sm, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  map: { flex: 1, overflow: 'hidden', borderTopWidth: 1, borderBottomWidth: 1, borderColor: Colors.border },
  bottom: { padding: Spacing.md, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  hint: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
});
