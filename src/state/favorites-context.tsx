import { createContext, useCallback, useContext, useEffect, useReducer, type ReactNode } from 'react';

import { hapticSelect } from '@/lib/haptics';
import { loadFavoriteIds, saveFavoriteIds } from '@/storage/favorites-storage';

import { useSession } from './session-context';

import { favoritesReducer, initialFavorites } from './favorites-reducer';

type FavoritesContextValue = {
  favoriteIds: string[];
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string) => void;
};

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const owner = session.status === 'authenticated' ? session.user.id : null;
  const [state, dispatch] = useReducer(favoritesReducer, initialFavorites);

  // หัวใจผูกกับบัญชี: เข้าสู่ระบบ/สลับบัญชี/ออกจากระบบ → โหลดรายการของบัญชีนั้น
  useEffect(() => {
    if (session.status === 'loading') return;
    dispatch({ type: 'switch', owner });
    loadFavoriteIds(owner).then((ids) => dispatch({ type: 'hydrate', owner, ids }));
  }, [session.status, owner]);

  useEffect(() => {
    // ห้ามบันทึกก่อนโหลดจากเครื่องเสร็จ ไม่งั้นจะเขียนรายการว่างทับของเดิม
    if (state.hydrated) saveFavoriteIds(state.owner, state.ids).catch(() => undefined);
  }, [state]);

  // ฟังก์ชันเดิมทุก render: การ์ดที่ห่อ memo จะไม่ render ซ้ำเพราะ prop นี้เปลี่ยน
  const toggleFavorite = useCallback((id: string) => {
    hapticSelect();
    dispatch({ type: 'toggle', id });
  }, []);

  const value: FavoritesContextValue = {
    favoriteIds: state.ids,
    isFavorite: (id) => state.ids.includes(id),
    toggleFavorite,
  };
  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

/** หน้าจอเรียกผ่าน hook นี้ ไม่แตะ Context ตรง ๆ จะเปลี่ยนวิธีเก็บทีหลังได้โดยไม่ต้องแก้หน้าจอ */
export function useFavorites(): FavoritesContextValue {
  const value = useContext(FavoritesContext);
  if (!value) throw new Error('useFavorites ต้องใช้ภายใน FavoritesProvider');
  return value;
}
