import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { ActivityCard } from '@/components/activity-card';
import { Text } from '@/components/app-text';
import { ActivityListSkeleton, FadeInView } from '@/components/motion';
import { useAppWidth } from '@/components/phone-frame';
import { SearchBox } from '@/components/search-box';
import { Banner, Chip, OfflineBanner, SectionHeader, StateView } from '@/components/ui';
import { Colors, MaxContentWidth, MinTouch, Radius, Spacing } from '@/constants/theme';
import { useDisplayStatus } from '@/hooks/use-display-status';
import { CATEGORIES, CATEGORY_ORDER } from '@/lib/categories';
import { browseActivities, type AvailabilityFilter, type CategoryFilter, type SortMode } from '@/lib/filter-activities';
import { useActivities } from '@/state/activities-context';
import { useFavorites } from '@/state/favorites-context';

const CATEGORY_FILTERS: {
  key: CategoryFilter;
  label: string;
  color?: string;
}[] = [
  { key: 'all', label: 'ทุกหมวด' },
  ...CATEGORY_ORDER.map((c) => ({
    key: c,
    label: CATEGORIES[c].label,
    color: CATEGORIES[c].color,
  })),
];

const AVAILABILITY_FILTERS: { key: AvailabilityFilter; label: string }[] = [
  { key: 'all', label: 'ทุกช่วงเวลา' },
  { key: 'week', label: 'ภายใน 7 วัน' },
  { key: 'open', label: 'ยังมีที่นั่ง' },
];

const SORTS: { key: SortMode; label: string }[] = [
  { key: 'date', label: 'ใกล้ถึงก่อน' },
  { key: 'seats', label: 'ที่นั่งว่างมาก' },
  { key: 'newest', label: 'ใหม่ล่าสุด' },
];

// ประกาศนอก component: เป็นฟังก์ชันเดิมทุก render การ์ด (memo) จึงไม่ render ซ้ำ
const openActivity = (id: string) => router.push({ pathname: '/activities/[id]', params: { id } });

/**
 * รายการกิจกรรมทั้งหมด + ค้นหา + ปุ่มตัวกรอง (แตะแล้วกางหมวด/ช่วงเวลา/การเรียง)
 * ใช้เป็นเนื้อหาหลักของหน้า "วันนี้" · top = หัวหน้า (อยู่เหนือช่องค้นหา)
 * header = การ์ดใหญ่ ที่ลงทะเบียนไว้ ฯลฯ อยู่ใต้ช่องค้นหา ซ่อนตอนค้นหา/กรอง ให้ผลลัพธ์ขึ้นมาใต้ช่องค้นหาทันที
 */
export function ActivityBrowser({ top, header, onRefresh }: { top?: ReactNode; header?: ReactNode; onRefresh?: () => void }) {
  const { activities, status, error, offlineSince, refresh } = useActivities();
  const { isFavorite, toggleFavorite } = useFavorites();
  const statusOf = useDisplayStatus();

  // state ของหน้านี้เอง (ไม่ต้องแชร์กับหน้าอื่น) จึงใช้ useState ธรรมดา
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [availability, setAvailability] = useState<AvailabilityFilter>('all');
  const [sort, setSort] = useState<SortMode>('date');
  const [showFilters, setShowFilters] = useState(false);

  // คำนวณตอน render ไม่เก็บรายการที่กรองแล้วไว้ใน state อีกชุด
  const visible = browseActivities(activities, {
    query,
    category,
    availability,
    sort,
  });
  const activeFilters = (category !== 'all' ? 1 : 0) + (availability !== 'all' ? 1 : 0) + (sort !== 'date' ? 1 : 0);
  const filtering = query.trim() !== '' || category !== 'all' || availability !== 'all';

  // จอกว้าง (แท็บเล็ต/เว็บ) แสดง 2 คอลัมน์ คำนวณจากพื้นที่จริง ไม่ยึดขนาดเครื่องเดียว
  const width = useAppWidth();
  const columns = Math.min(width, MaxContentWidth) >= 720 ? 2 : 1;

  const clearFilters = () => {
    setQuery('');
    setCategory('all');
    setAvailability('all');
    setSort('date');
  };

  const listHeader = (
    <View style={styles.header}>
      {top}
      <View style={styles.searchRow}>
        <View style={{ flex: 1 }}>
          <SearchBox value={query} onChangeText={setQuery} placeholder="ค้นหาชื่อกิจกรรมหรือสถานที่" label="ค้นหากิจกรรม" />
        </View>
        <Pressable
          onPress={() => setShowFilters((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={activeFilters > 0 ? `ตัวกรอง เลือกไว้ ${activeFilters} อย่าง` : 'ตัวกรอง'}
          accessibilityState={{ expanded: showFilters }}
          style={({ pressed }) => [
            styles.filterButton,
            (showFilters || activeFilters > 0) && styles.filterButtonOn,
            pressed && { opacity: 0.85 },
          ]}>
          <Ionicons name="options-outline" size={22} color={showFilters || activeFilters > 0 ? Colors.onPrimary : Colors.text} />
          {activeFilters > 0 ? (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilters}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {showFilters ? (
        <View style={styles.panel}>
          <FilterGroup title="หมวด">
            {CATEGORY_FILTERS.map((o) => (
              <Chip key={o.key} label={o.label} color={o.color} selected={category === o.key} onPress={() => setCategory(o.key)} />
            ))}
          </FilterGroup>
          <FilterGroup title="ช่วงเวลา">
            {AVAILABILITY_FILTERS.map((o) => (
              <Chip key={o.key} label={o.label} selected={availability === o.key} onPress={() => setAvailability(o.key)} />
            ))}
          </FilterGroup>
          <FilterGroup title="เรียงตาม">
            {SORTS.map((o) => (
              <Chip key={o.key} label={o.label} selected={sort === o.key} onPress={() => setSort(o.key)} />
            ))}
          </FilterGroup>
          {activeFilters > 0 ? (
            <Pressable onPress={clearFilters} accessibilityRole="button" hitSlop={8} style={styles.reset}>
              <Text style={styles.resetText}>ล้างตัวกรอง</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {filtering || activeFilters > 0 ? null : header}
      <SectionHeader
        eyebrow={filtering ? 'RESULTS' : 'ALL ACTIVITIES'}
        title={filtering ? 'ผลการค้นหา' : 'กิจกรรมทั้งหมด'}
        actionLabel={filtering || activeFilters > 0 ? 'ล้างตัวกรอง' : undefined}
        onAction={clearFilters}
      />
      <Text style={styles.count} accessibilityLiveRegion="polite">
        {filtering ? `พบ ${visible.length} กิจกรรม` : `ทั้งหมด ${visible.length} กิจกรรม`} · เรียง{SORTS.find((o) => o.key === sort)?.label}
      </Text>
      <OfflineBanner since={offlineSince} note="ที่นั่งคงเหลืออาจไม่ตรงกับปัจจุบัน" />
      {error && status === 'ready' ? <Banner tone="danger">{error}</Banner> : null}
    </View>
  );

  let empty;
  if (status === 'loading') {
    empty = <ActivityListSkeleton />;
  } else if (status === 'error') {
    empty = <StateView kind="error" title="โหลดกิจกรรมไม่สำเร็จ" message={error ?? undefined} actionLabel="ลองใหม่" onAction={refresh} />;
  } else {
    empty = (
      <StateView
        kind="empty"
        icon="search"
        title="ไม่พบกิจกรรม"
        message="ลองเปลี่ยนคำค้นหรือตัวกรอง"
        actionLabel="ล้างตัวกรอง"
        onAction={clearFilters}
      />
    );
  }

  return (
    <FlatList
      key={`cols-${columns}`}
      data={visible}
      numColumns={columns}
      keyExtractor={(item) => item.id}
      renderItem={({ item, index }) => (
        <FadeInView index={index} style={styles.cell}>
          <ActivityCard
            activity={item}
            isFavorite={isFavorite(item.id)}
            status={statusOf(item.id)}
            onOpen={openActivity}
            onToggleFavorite={toggleFavorite}
          />
        </FadeInView>
      )}
      ListHeaderComponent={listHeader}
      ListEmptyComponent={empty}
      columnWrapperStyle={columns > 1 ? styles.row : undefined}
      contentContainerStyle={styles.list}
      style={{ backgroundColor: Colors.background }}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={status === 'refreshing'} onRefresh={onRefresh ?? refresh} tintColor={Colors.primary} />}
    />
  );
}

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: Spacing.sm }}>
      <Text style={styles.groupTitle}>{title}</Text>
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    padding: Spacing.lg,
    gap: Spacing.md,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  header: { gap: Spacing.lg, marginBottom: Spacing.xs },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  filterButton: {
    width: MinTouch + 10,
    height: MinTouch + 10,
    borderRadius: (MinTouch + 10) / 2,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterButtonOn: { backgroundColor: Colors.ink, borderColor: Colors.ink },
  filterBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: Colors.highlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: { fontSize: 11, fontWeight: '800', color: Colors.ink },
  panel: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.md,
    marginTop: -Spacing.xs,
  },
  groupTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.4,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  reset: { alignSelf: 'flex-start' },
  resetText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
    textDecorationLine: 'underline',
  },
  count: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '600',
    marginTop: -Spacing.xs,
  },
  row: { gap: Spacing.md },
  cell: { flex: 1 },
});
