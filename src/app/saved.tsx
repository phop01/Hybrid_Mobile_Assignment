import { router } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';

import { ActivityCard } from '@/components/activity-card';
import { Banner, StateView } from '@/components/ui';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useDisplayStatus } from '@/hooks/use-display-status';
import { sortForBrowsing } from '@/lib/filter-activities';
import { useActivities } from '@/state/activities-context';
import { useFavorites } from '@/state/favorites-context';

/**
 * บันทึกไว้ ≠ ลงทะเบียน
 * ลงทะเบียนแล้วจะกินที่นั่ง ถ้ายังไม่แน่ใจให้บันทึกไว้ก่อน ที่นั่งจะไม่ถูกจองทิ้ง
 * ไม่ต้อง login และเก็บในเครื่อง
 */
// ประกาศนอก component: เป็นฟังก์ชันเดิมทุก render การ์ด (memo) จึงไม่ render ซ้ำ
const openActivity = (id: string) => router.push({ pathname: '/activities/[id]', params: { id } });

export default function SavedScreen() {
  const { activities, status } = useActivities();
  const { favoriteIds, isFavorite, toggleFavorite } = useFavorites();
  const statusOf = useDisplayStatus();

  const saved = sortForBrowsing(activities.filter((a) => favoriteIds.includes(a.id)));

  return (
    <FlatList
      data={saved}
      keyExtractor={(item) => item.id}
      style={{ backgroundColor: Colors.background }}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        saved.length > 0 ? (
          <Banner tone="info">บันทึกไว้ไม่ได้จองที่นั่ง ถ้าตัดสินใจจะไปแล้ว อย่าลืมกดลงทะเบียน</Banner>
        ) : null
      }
      renderItem={({ item }) => (
        <View>
          <ActivityCard
            activity={item}
            isFavorite={isFavorite(item.id)}
            status={statusOf(item.id)}
            onOpen={openActivity}
            onToggleFavorite={toggleFavorite}
          />
        </View>
      )}
      ListEmptyComponent={
        status === 'loading' ? (
          <StateView kind="loading" />
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
  list: { padding: Spacing.lg, gap: Spacing.md, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
});
