import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/app-text';
import { MapSelectionCard } from '@/components/map-selection-card';
import { PickMap } from '@/components/pick-map';
import { TopBar } from '@/components/top-bar';
import { Card, ChipBar, OfflineBanner, Screen, SectionHeader, StateView } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { BROADCAST_COLOR, MAP_LAYERS, useCampusMarkers, type MapLayer } from '@/hooks/use-campus-markers';
import { useLocateMe } from '@/hooks/use-locate-me';
import { CATEGORIES } from '@/lib/categories';
import { formatDistance } from '@/lib/format';
import { nearestActivities } from '@/lib/nearby';
import { useActivities } from '@/state/activities-context';

/**
 * แผนที่รวมทุกเรื่องในวิทยาเขต: กิจกรรมที่ยังไม่จบ และประกาศ
 * การ์ดแผนที่ในหน้า + ปุ่ม "ขยายแผนที่" เปิดแบบเต็มจอ · แตะหมุดหรือรายการ → การ์ดรายละเอียดใต้แผนที่
 * ตำแหน่งของฉัน: ขอสิทธิ์เฉพาะตอนกดปุ่ม แล้วแสดงกิจกรรมที่ใกล้ที่สุด
 */
export default function MapScreen() {
  const { activities, status, error, offlineSince, refresh } = useActivities();
  const [layer, setLayer] = useState<MapLayer>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // แตะ/ลากแผนที่อยู่ → ปิดการเลื่อนหน้า (บน iPhone ScrollView แย่งนิ้ว)
  const [mapTouch, setMapTouch] = useState(false);
  const { me, locating, note, locate } = useLocateMe();
  const { markers, selection } = useCampusMarkers(layer, selectedId);

  const nearby = useMemo(() => (me ? nearestActivities(activities, me, 3) : []), [activities, me]);
  const onSelect = useCallback((id: string | null) => setSelectedId(id), []);

  if (status === 'loading') return <StateView kind="loading" message="กำลังโหลดแผนที่…" />;
  if (status === 'error' && activities.length === 0) {
    return <StateView kind="error" title="โหลดข้อมูลไม่สำเร็จ" message={error ?? undefined} actionLabel="ลองใหม่" onAction={refresh} />;
  }

  const activityCount = markers.filter((m) => m.id.startsWith('a:')).length;
  const broadcastCount = markers.length - activityCount;
  const openFull = () => router.push({ pathname: '/map-full', params: { layer, ...(selectedId ? { selected: selectedId } : {}) } });

  return (
    <Screen scrollEnabled={!mapTouch}>
      <TopBar
        eyebrow="CAMPUS MAP · แผนที่"
        title="แผนที่วิทยาเขต"
        subtitle={`กิจกรรม ${activityCount} จุด · ประกาศ ${broadcastCount} จุด`}
      />
      <ChipBar
        options={MAP_LAYERS}
        value={layer}
        onChange={(key) => {
          setLayer(key);
          setSelectedId(null);
        }}
      />
      <OfflineBanner since={offlineSince} />

      {/* การ์ดแผนที่: ป้ายจุดที่เลือกมุมบน · ปุ่มตำแหน่งของฉัน + ขยายแผนที่มุมล่าง */}
      <View style={styles.mapCard}>
        {markers.length > 0 ? (
          <PickMap
            markers={markers}
            selectedId={selectedId}
            onSelectMarker={onSelect}
            user={me}
            onInteractingChange={setMapTouch}
            accessibilityLabel={`แผนที่วิทยาเขต ${markers.length} จุด`}
          />
        ) : (
          <StateView kind="empty" icon="map-outline" title="ไม่มีเรื่องในหมวดนี้บนแผนที่" />
        )}
        <View pointerEvents="none" style={styles.mapLabel}>
          <Text style={styles.mapLabelEyebrow}>{selection ? 'SELECTED' : 'KKU NONG KHAI'}</Text>
          <Text style={styles.mapLabelName} numberOfLines={1}>
            {selection?.kind === 'activity'
              ? selection.activity.title
              : selection?.kind === 'broadcast'
                ? 'ประกาศ'
                : 'มข. วิทยาเขตหนองคาย'}
          </Text>
        </View>
        <View style={styles.mapButtons}>
          <Pressable
            onPress={locate}
            disabled={locating}
            accessibilityRole="button"
            accessibilityLabel={me ? 'อัปเดตตำแหน่งของฉัน' : 'แสดงตำแหน่งของฉัน'}
            style={({ pressed }) => [styles.roundButton, pressed && { opacity: 0.85 }]}>
            {locating ? <ActivityIndicator color={Colors.primary} /> : <Ionicons name="locate" size={22} color={Colors.primary} />}
          </Pressable>
          <Pressable
            onPress={openFull}
            accessibilityRole="button"
            accessibilityLabel="เปิดแผนที่แบบเต็มหน้าจอ"
            style={({ pressed }) => [styles.expand, pressed && { opacity: 0.85 }]}>
            <Ionicons name="expand" size={18} color={Colors.ink} />
            <Text style={styles.expandText}>ขยายแผนที่</Text>
          </Pressable>
        </View>
      </View>
      {note ? <Text style={styles.hint}>{note}</Text> : null}

      {selection ? <MapSelectionCard selection={selection} /> : null}

      {nearby.length > 0 ? (
        <Card>
          <SectionHeader eyebrow="NEAR YOU" title="กิจกรรมใกล้คุณ" />
          {nearby.map(({ activity: a, meters, walkMinutes }) => (
            <PlaceRow
              key={a.id}
              color={CATEGORIES[a.category].color}
              icon={CATEGORIES[a.category].icon}
              title={a.title}
              sub={`${formatDistance(meters)} · เดิน ${walkMinutes} นาที`}
              selected={selectedId === `a:${a.id}`}
              onPress={() => setSelectedId(`a:${a.id}`)}
            />
          ))}
        </Card>
      ) : null}

      {markers.length > 0 ? (
        <Card>
          <SectionHeader eyebrow="ON THE MAP" title={`จุดบนแผนที่ ${markers.length} จุด`} />
          {/* แผนที่ใช้กับ screen reader ได้ยาก จึงมีรายการเดียวกันให้แตะเลือกได้ */}
          {markers.map((m) => {
            const isActivity = m.id.startsWith('a:');
            const a = isActivity ? activities.find((x) => x.id === m.id.slice(2)) : undefined;
            return (
              <PlaceRow
                key={m.id}
                color={isActivity ? m.color : BROADCAST_COLOR}
                icon={a ? CATEGORIES[a.category].icon : 'megaphone'}
                title={isActivity ? m.title : m.subtitle ?? 'ประกาศ'}
                sub={isActivity ? m.subtitle ?? '' : 'ประกาศ'}
                selected={selectedId === m.id}
                onPress={() => setSelectedId(selectedId === m.id ? null : m.id)}
              />
            );
          })}
        </Card>
      ) : null}
    </Screen>
  );
}

function PlaceRow({
  color,
  icon,
  title,
  sub,
  selected,
  onPress,
}: {
  color: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  sub: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${title} ${sub}`}
      style={({ pressed }) => [styles.row, selected && styles.rowSelected, pressed && { opacity: 0.85 }]}>
      <View style={[styles.rowIcon, { backgroundColor: color }]}>
        <Ionicons name={icon} size={16} color="#FFFFFF" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          {sub}
        </Text>
      </View>
      {selected ? <Ionicons name="checkmark-circle" size={20} color={Colors.primary} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  mapCard: {
    height: 340,
    borderRadius: Radius.xxl,
    overflow: 'hidden',
    backgroundColor: Colors.border,
  },
  mapLabel: {
    position: 'absolute',
    top: Spacing.md,
    left: Spacing.md,
    right: Spacing.md,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(11,36,54,0.88)',
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  mapLabelEyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1.6, color: Colors.highlight },
  mapLabelName: { fontSize: 15, fontWeight: '800', color: Colors.onPrimary },
  mapButtons: {
    position: 'absolute',
    bottom: Spacing.md,
    right: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  roundButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  expand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 46,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.pill,
    backgroundColor: Colors.highlight,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  expandText: { fontSize: 14, fontWeight: '800', color: Colors.ink },
  hint: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 19 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: 52, paddingHorizontal: Spacing.sm, borderRadius: Radius.lg },
  rowSelected: { backgroundColor: Colors.primarySoft },
  rowIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  rowSub: { fontSize: 12, color: Colors.textMuted },
});
