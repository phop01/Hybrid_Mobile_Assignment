import { router } from 'expo-router';
import { useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ActivityCard } from '@/components/activity-card';
import { useAppWidth } from '@/components/phone-frame';
import { Banner, ChipBar, OfflineBanner, StateView } from '@/components/ui';
import { Colors, MaxContentWidth, MinTouch, Radius, Spacing } from '@/constants/theme';
import { useDisplayStatus } from '@/hooks/use-display-status';
import { CATEGORIES, CATEGORY_ORDER } from '@/lib/categories';
import { filterActivities, isEnded, sortForBrowsing, type CategoryFilter } from '@/lib/filter-activities';
import { useActivities } from '@/state/activities-context';
import { useFavorites } from '@/state/favorites-context';
import { useAuthenticatedSession } from '@/state/session-context';

const CATEGORY_FILTERS: { key: CategoryFilter; label: string; color?: string }[] = [
  { key: 'all', label: 'ทั้งหมด' },
  ...CATEGORY_ORDER.map((c) => ({ key: c, label: CATEGORIES[c].label, color: CATEGORIES[c].color })),
];

// ประกาศนอก component: เป็นฟังก์ชันเดิมทุก render การ์ด (memo) จึงไม่ render ซ้ำ
const openActivity = (id: string) => router.push({ pathname: '/activities/[id]', params: { id } });

export default function ActivitiesScreen() {
  const { activities, status, error, offlineSince, refresh } = useActivities();
  const { isFavorite, toggleFavorite } = useFavorites();
  const statusOf = useDisplayStatus();
  const session = useAuthenticatedSession();
  const upcoming = activities.filter((a) => !isEnded(a)).length;

  // state ของหน้านี้เอง (ไม่ต้องแชร์กับหน้าอื่น) จึงใช้ useState ธรรมดา
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');

  // คำนวณตอน render ไม่เก็บรายการที่กรองแล้วไว้ใน state อีกชุด
  const visible = filterActivities(sortForBrowsing(activities), query, category);

  // จอกว้าง (แท็บเล็ต/เว็บ) แสดง 2 คอลัมน์ คำนวณจากพื้นที่จริง ไม่ยึดขนาดเครื่องเดียว
  const width = useAppWidth();
  const columns = Math.min(width, MaxContentWidth) >= 720 ? 2 : 1;

  const clearFilters = () => {
    setQuery('');
    setCategory('all');
  };

  const header = (
    <View style={styles.header}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle} accessibilityRole="header">
          {session ? `สวัสดี ${session.user.fullName.split(' ')[0]}` : 'กิจกรรมในมหาวิทยาลัย'}
        </Text>
        <Text style={styles.heroText}>มี {upcoming} กิจกรรมที่กำลังจะมาถึง เลือกเข้าร่วมเพื่อสะสมชั่วโมง</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="ค้นหาชื่อกิจกรรมหรือสถานที่"
          placeholderTextColor={Colors.textMuted}
          accessibilityLabel="ค้นหากิจกรรม"
          style={styles.search}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>
      <ChipBar options={CATEGORY_FILTERS} value={category} onChange={setCategory} />
      <OfflineBanner since={offlineSince} note="ที่นั่งคงเหลืออาจไม่ตรงกับปัจจุบัน" />
      {error && status === 'ready' ? <Banner tone="danger">{error}</Banner> : null}
    </View>
  );

  let empty;
  if (status === 'loading') {
    empty = <StateView kind="loading" message="กำลังโหลดกิจกรรม…" />;
  } else if (status === 'error') {
    empty = (
      <StateView
        kind="error"
        title="โหลดกิจกรรมไม่สำเร็จ"
        message={error ?? undefined}
        actionLabel="ลองใหม่"
        onAction={refresh}
      />
    );
  } else {
    empty = (
      <StateView
        kind="empty"
        icon="search"
        title="ไม่พบกิจกรรม"
        message="ลองเปลี่ยนคำค้นหรือประเภทกิจกรรม"
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
      renderItem={({ item }) => (
        <View style={styles.cell}>
          <ActivityCard
            activity={item}
            isFavorite={isFavorite(item.id)}
            status={statusOf(item.id)}
            onOpen={openActivity}
            onToggleFavorite={toggleFavorite}
          />
        </View>
      )}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      columnWrapperStyle={columns > 1 ? styles.row : undefined}
      contentContainerStyle={styles.list}
      style={{ backgroundColor: Colors.background }}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl refreshing={status === 'refreshing'} onRefresh={refresh} tintColor={Colors.primary} />
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: Spacing.lg, gap: Spacing.md, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  header: { gap: Spacing.md, marginBottom: Spacing.xs },
  hero: { backgroundColor: Colors.primary, borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.sm },
  heroTitle: { fontSize: 22, fontWeight: '800', color: Colors.onPrimary },
  heroText: { fontSize: 14, color: Colors.onPrimaryMuted, lineHeight: 20, marginBottom: Spacing.xs },
  search: {
    minHeight: MinTouch + 4,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
    color: Colors.text,
  },
  row: { gap: Spacing.md },
  cell: { flex: 1 },
});
