import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { ActivityCard } from '@/components/activity-card';
import { ActivityListSkeleton, FadeInView } from '@/components/motion';
import { SearchBox } from '@/components/search-box';
import { Banner, Button, ChipBar, StateView } from '@/components/ui';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useDisplayStatus } from '@/hooks/use-display-status';
import { CATEGORIES, CATEGORY_ORDER } from '@/lib/categories';
import { filterActivities, isEnded, sortForBrowsing, type CategoryFilter } from '@/lib/filter-activities';
import { useActivities } from '@/state/activities-context';
import { useFavorites } from '@/state/favorites-context';
import { Text } from '@/components/app-text';

/**
 * บันทึกไว้ ≠ ลงทะเบียน
 * ลงทะเบียนแล้วจะกินที่นั่ง ถ้ายังไม่แน่ใจให้บันทึกไว้ก่อน ที่นั่งจะไม่ถูกจองทิ้ง
 * ไม่ต้อง login และเก็บในเครื่อง
 */
const CATEGORY_FILTERS: { key: CategoryFilter; label: string; color?: string }[] = [
  { key: 'all', label: 'ทั้งหมด' },
  ...CATEGORY_ORDER.map((c) => ({ key: c, label: CATEGORIES[c].label, color: CATEGORIES[c].color })),
];

// ประกาศนอก component: เป็นฟังก์ชันเดิมทุก render การ์ด (memo) จึงไม่ render ซ้ำ
const openActivity = (id: string) => router.push({ pathname: '/activities/[id]', params: { id } });

export default function SavedScreen() {
  const { activities, status } = useActivities();
  const { favoriteIds, isFavorite, toggleFavorite } = useFavorites();
  const statusOf = useDisplayStatus();

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');

  const allSaved = sortForBrowsing(activities.filter((a) => favoriteIds.includes(a.id)));
  const saved = filterActivities(allSaved, query, category);
  const endedSaved = allSaved.filter((a) => isEnded(a));
  const openCount = allSaved.length - endedSaved.length;

  return (
    <FlatList
      data={saved}
      keyExtractor={(item) => item.id}
      style={{ backgroundColor: Colors.background }}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        allSaved.length > 0 ? (
          <View style={styles.header}>
            <View style={styles.summary}>
              <Text style={styles.summaryNumber}>{allSaved.length}</Text>
              <Text style={styles.summaryText}>
                กิจกรรมที่บันทึกไว้ · ยังเปิดอยู่ {openCount}
                {endedSaved.length > 0 ? ` · จบแล้ว ${endedSaved.length}` : ''}
              </Text>
            </View>
            <SearchBox value={query} onChangeText={setQuery} placeholder="ค้นหาในที่บันทึกไว้" label="ค้นหากิจกรรมที่บันทึกไว้" />
            <ChipBar options={CATEGORY_FILTERS} value={category} onChange={setCategory} />
            <Banner tone="info">บันทึกไว้ไม่ได้จองที่นั่ง ถ้าตัดสินใจจะไปแล้ว อย่าลืมกดลงทะเบียน</Banner>
            {endedSaved.length > 0 ? (
              <Button
                title={`เอากิจกรรมที่จบแล้วออก (${endedSaved.length})`}
                icon="trash-outline"
                variant="ghost"
                onPress={() => endedSaved.forEach((a) => toggleFavorite(a.id))}
              />
            ) : null}
          </View>
        ) : null
      }
      renderItem={({ item, index }) => (
        <FadeInView index={index}>
          <ActivityCard
            activity={item}
            isFavorite={isFavorite(item.id)}
            status={statusOf(item.id)}
            onOpen={openActivity}
            onToggleFavorite={toggleFavorite}
          />
        </FadeInView>
      )}
      ListEmptyComponent={
        status === 'loading' ? (
          <ActivityListSkeleton count={2} message="กำลังโหลดกิจกรรมที่บันทึกไว้…" />
        ) : allSaved.length > 0 ? (
          <StateView
            kind="empty"
            icon="search"
            title="ไม่พบในที่บันทึกไว้"
            message="ลองเปลี่ยนคำค้นหรือหมวดกิจกรรม"
            actionLabel="ล้างตัวกรอง"
            onAction={() => {
              setQuery('');
              setCategory('all');
            }}
          />
        ) : (
          <StateView
            kind="empty"
            icon="star-outline"
            title="ยังไม่มีกิจกรรมที่บันทึกไว้"
            message="แตะ ☆ บนการ์ดกิจกรรมเพื่อเก็บไว้ดูทีหลัง"
            actionLabel="ไปดูกิจกรรม"
            onAction={() => router.navigate('/activities')}
          />
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.md },
  summary: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  summaryNumber: { fontSize: 40, fontWeight: '800', color: Colors.primary },
  summaryText: { flex: 1, fontSize: 14, color: Colors.textMuted, lineHeight: 20 },
  list: { padding: Spacing.lg, gap: Spacing.md, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
});
