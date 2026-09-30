// ใช้ reducer เพราะรายการบันทึกไว้มีหลาย action (โหลดจากเครื่อง / สลับ / ล้าง)
// และเป็น pure function จึงเขียน test ได้โดยไม่ต้อง render อะไร

export type FavoritesState = { ids: string[]; hydrated: boolean };

export type FavoritesAction =
  | { type: 'hydrate'; ids: string[] }
  | { type: 'toggle'; id: string }
  | { type: 'clear' };

export const initialFavorites: FavoritesState = { ids: [], hydrated: false };

export function favoritesReducer(state: FavoritesState, action: FavoritesAction): FavoritesState {
  switch (action.type) {
    case 'hydrate':
      // ถ้าผู้ใช้กดบันทึกก่อนโหลดเสร็จ รวมทั้งสองชุดไว้ ไม่ทิ้งสิ่งที่เพิ่งกด
      return { ids: [...new Set([...action.ids, ...state.ids])], hydrated: true };
    case 'toggle':
      return {
        ...state,
        ids: state.ids.includes(action.id) ? state.ids.filter((id) => id !== action.id) : [...state.ids, action.id],
      };
    case 'clear':
      return { ...state, ids: [] };
  }
}
