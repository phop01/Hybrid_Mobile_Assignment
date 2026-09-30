import { useCallback, useState } from 'react';
import { RefreshControl } from 'react-native';

import { Colors } from '@/constants/theme';

/** ดึงลงเพื่อรีเฟรช: หมุนระหว่างรอ refresh() เสร็จ แล้วหยุดเอง (ใช้ซ้ำทุกหน้าที่เป็นรายการ) */
export function useRefreshControl(refresh: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);
  return <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />;
}
