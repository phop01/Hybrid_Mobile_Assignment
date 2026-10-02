import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ActivityCard } from '@/components/activity-card';
import { BroadcastCard } from '@/components/broadcast-card';
import { PickMap, type MapMarker } from '@/components/pick-map';
import { Button, ChipBar, OfflineBanner, StateView } from '@/components/ui';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useDisplayStatus } from '@/hooks/use-display-status';
import { CATEGORIES } from '@/lib/categories';
import { isEnded } from '@/lib/filter-activities';
import { formatDistance } from '@/lib/format';
import type { Coordinates } from '@/lib/geo';
import { nearestActivities } from '@/lib/nearby';
import { getCurrentCoordinates } from '@/services/location';
import { useActivities } from '@/state/activities-context';
import { useBroadcasts } from '@/state/broadcasts-context';
import { useFavorites } from '@/state/favorites-context';
import { Text } from '@/components/app-text';

type Layer = 'all' | 'activity' | 'broadcast';

const LAYERS: { key: Layer; label: string }[] = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'activity', label: 'กิจกรรม' },
  { key: 'broadcast', label: 'ประกาศ' },
];

const BROADCAST_COLOR = '#A15C07';

/**
 * แผนที่รวมทุกเรื่องในวิทยาเขต: กิจกรรมที่ยังไม่จบ และประกาศ
 * แตะหมุด → การ์ดด้านล่าง → แตะการ์ดเพื่อดูรายละเอียด
 * ตำแหน่งของฉัน: ขอสิทธิ์เฉพาะตอนกดปุ่ม "ตำแหน่งของฉัน" (ไม่ติดตามเบื้องหลัง) แล้วแสดงกิจกรรมที่ใกล้ที่สุด
 */
export default function MapScreen() {
  const { activities, status, error, offlineSince, refresh } = useActivities();
  const { broadcasts } = useBroadcasts();
  const { isFavorite, toggleFavorite } = useFavorites();
  const statusOf = useDisplayStatus();
  const [layer, setLayer] = useState<Layer>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [me, setMe] = useState<Coordinates | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationNote, setLocationNote] = useState<string | null>(null);

  const locateMe = async () => {
    setLocating(true);
    setLocationNote(null);
    const result = await getCurrentCoordinates();
    setLocating(false);
    if (result.status === 'ok') setMe(result.coords);
    else if (result.status === 'denied') {
      setLocationNote(result.canAskAgain ? 'ต้องอนุญาตตำแหน่งก่อนจึงจะแสดงตำแหน่งของคุณได้' : 'ปิดสิทธิ์ตำแหน่งไว้ เปิดได้ที่การตั้งค่าของเครื่อง');
    } else setLocationNote('หาตำแหน่งไม่เจอ ลองออกไปที่โล่งแล้วกดใหม่');
  };

  const nearby = useMemo(() => (me ? nearestActivities(activities, me, 3) : []), [activities, me]);

  // useMemo จำเป็นที่นี่: แผนที่บนเว็บสร้างใหม่ทั้งแผ่นเมื่อรายการหมุดเปลี่ยน ต้องไม่เปลี่ยนทุก render
  const markers = useMemo((): MapMarker[] => {
    const show = (l: Layer) => layer === 'all' || layer === l;
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

  const onSelect = useCallback((id: string | null) => setSelectedId(id), []);
  const [type, rawId] = selectedId ? [selectedId.slice(0, 1), selectedId.slice(2)] : [null, null];
  const activity = type === 'a' ? activities.find((a) => a.id === rawId) : undefined;
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
        <Button
          title={me ? 'อัปเดตตำแหน่งของฉัน' : 'ตำแหน่งของฉัน'}
          icon="locate"
          variant="secondary"
          loading={locating}
          onPress={locateMe}
        />
        {locationNote ? <Text style={styles.hint}>{locationNote}</Text> : null}
      </View>

      <View style={styles.map}>
        {markers.length > 0 ? (
          <PickMap
            markers={markers}
            selectedId={selectedId}
            onSelectMarker={onSelect}
            user={me}
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
        ) : broadcast ? (
          <BroadcastCard broadcast={broadcast} compact />
        ) : nearby.length > 0 ? (
          <View style={{ gap: Spacing.xs }}>
            <Text style={styles.nearTitle}>กิจกรรมใกล้คุณ</Text>
            {nearby.map(({ activity: a, meters, walkMinutes }) => (
              <Pressable
                key={a.id}
                style={styles.nearRow}
                accessibilityRole="button"
                accessibilityLabel={`${a.title} ห่าง ${formatDistance(meters)} เดินประมาณ ${walkMinutes} นาที`}
                onPress={() => setSelectedId(`a:${a.id}`)}>
                <View style={[styles.nearDot, { backgroundColor: CATEGORIES[a.category].color }]} />
                <Text style={styles.nearText} numberOfLines={1}>
                  {a.title}
                </Text>
                <Text style={styles.nearDistance}>
                  {formatDistance(meters)} · เดิน {walkMinutes} นาที
                </Text>
              </Pressable>
            ))}
          </View>
        ) : (
          // แผนที่ใช้กับ screen reader ได้ยาก จึงบอกทางเลือกที่เป็นรายการไว้ด้วย
          <Text style={styles.hint}>แตะหมุดเพื่อดูรายละเอียด · {markers.length} จุด · ดูแบบรายการได้ที่แท็บกิจกรรม</Text>
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
  nearTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  nearRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: 44 },
  nearDot: { width: 10, height: 10, borderRadius: 5 },
  nearText: { flex: 1, fontSize: 14, color: Colors.text },
  nearDistance: { fontSize: 13, color: Colors.textMuted },
  hint: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
});
