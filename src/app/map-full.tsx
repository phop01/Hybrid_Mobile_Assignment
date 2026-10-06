import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/app-text';
import { MapSelectionCard } from '@/components/map-selection-card';
import { PickMap } from '@/components/pick-map';
import { ChipBar } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { firstParam } from '@/hooks/use-activity';
import { MAP_LAYERS, useCampusMarkers, type MapLayer } from '@/hooks/use-campus-markers';
import { useLocateMe } from '@/hooks/use-locate-me';

const isLayer = (v: string | undefined): v is MapLayer => MAP_LAYERS.some((l) => l.key === v);

/**
 * แผนที่เต็มจอ (เปิดจากปุ่ม "ขยายแผนที่"): แผนที่เต็มหน้า · แถบบนมีปุ่มปิด ชื่อ และปุ่มกลับจุดเริ่ม
 * จุดที่เลือกแสดงเป็นการ์ดลอยล่างจอ · รับชั้นข้อมูลและจุดที่เลือกจากแท็บแผนที่ผ่าน params
 */
export default function FullMapScreen() {
  const params = useLocalSearchParams<{ layer?: string; selected?: string }>();
  const layerParam = firstParam(params.layer);
  const insets = useSafeAreaInsets();
  const [layer, setLayer] = useState<MapLayer>(isLayer(layerParam) ? layerParam : 'all');
  const [selectedId, setSelectedId] = useState<string | null>(firstParam(params.selected) ?? null);
  // เปลี่ยน key = สร้างแผนที่ใหม่ กลับไปมุมมองที่เห็นทุกหมุด
  const [mapKey, setMapKey] = useState(0);
  const { me, locating, note, locate } = useLocateMe();
  const { markers, selection } = useCampusMarkers(layer, selectedId);
  const onSelect = useCallback((id: string | null) => setSelectedId(id), []);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/map'));

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false, animation: 'slide_from_bottom' }} />
      <PickMap
        key={mapKey}
        markers={markers}
        selectedId={selectedId}
        onSelectMarker={onSelect}
        user={me}
        accessibilityLabel={`แผนที่วิทยาเขตเต็มหน้าจอ ${markers.length} จุด`}
      />

      <View pointerEvents="box-none" style={[styles.overlay, { paddingTop: insets.top + Spacing.sm, paddingBottom: insets.bottom + Spacing.md }]}>
        <View style={styles.topBar}>
          <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="ปิดแผนที่เต็มหน้าจอ" style={styles.circle}>
            <Ionicons name="close" size={24} color={Colors.text} />
          </Pressable>
          <View style={styles.titleWrap}>
            <Text style={styles.eyebrow}>KKU NONG KHAI · MAP</Text>
            <Text style={styles.title} numberOfLines={1}>
              แผนที่วิทยาเขต · {markers.length} จุด
            </Text>
          </View>
          <Pressable
            onPress={() => {
              setSelectedId(null);
              setMapKey((k) => k + 1);
            }}
            accessibilityRole="button"
            accessibilityLabel="กลับไปมุมมองที่เห็นทุกจุด"
            style={styles.circle}>
            <Ionicons name="scan" size={22} color={Colors.text} />
          </Pressable>
        </View>
        <View style={styles.layers}>
          <ChipBar
            options={MAP_LAYERS}
            value={layer}
            onChange={(key) => {
              setLayer(key);
              setSelectedId(null);
            }}
          />
        </View>

        <View pointerEvents="box-none" style={styles.bottom}>
          <View style={styles.bottomButtons}>
            <Pressable
              onPress={locate}
              disabled={locating}
              accessibilityRole="button"
              accessibilityLabel={me ? 'อัปเดตตำแหน่งของฉัน' : 'แสดงตำแหน่งของฉัน'}
              style={styles.circle}>
              {locating ? <ActivityIndicator color={Colors.primary} /> : <Ionicons name="locate" size={22} color={Colors.primary} />}
            </Pressable>
          </View>
          {note ? (
            <View style={styles.note}>
              <Text style={styles.noteText}>{note}</Text>
            </View>
          ) : null}
          {selection ? (
            <MapSelectionCard selection={selection} floating />
          ) : (
            <View style={styles.note}>
              <Text style={styles.noteText}>แตะหมุดเพื่อดูรายละเอียด</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const shadow = {
  shadowColor: '#000',
  shadowOpacity: 0.16,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 4 },
  elevation: 6,
} as const;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.border },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, paddingHorizontal: Spacing.lg, justifyContent: 'space-between' },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  circle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  titleWrap: {
    flex: 1,
    backgroundColor: 'rgba(11,36,54,0.9)',
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
  },
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1.6, color: Colors.highlight },
  title: { fontSize: 15, fontWeight: '800', color: Colors.onPrimary },
  layers: { marginTop: Spacing.sm, alignSelf: 'flex-start' },
  bottom: { flex: 1, justifyContent: 'flex-end', gap: Spacing.sm },
  bottomButtons: { alignItems: 'flex-end' },
  note: {
    alignSelf: 'center',
    backgroundColor: 'rgba(11,36,54,0.9)',
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  noteText: { color: Colors.onPrimary, fontSize: 13, fontWeight: '600' },
});
