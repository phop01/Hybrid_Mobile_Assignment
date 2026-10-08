// ใช้ reducer เพราะรายการบันทึกไว้มีหลาย action (เปลี่ยนบัญชี / โหลดจากเครื่อง / สลับ / ล้าง)
// และเป็น pure function จึงเขียน test ได้โดยไม่ต้อง render อะไร

/** owner = id บัญชีที่เป็นเจ้าของรายการ (null = ยังไม่เข้าสู่ระบบ) */
export type FavoritesState = { ids: string[]; hydrated: boolean; owner: string | null };

export type FavoritesAction =
  | { type: 'switch'; owner: string | null }
  | { type: 'hydrate'; owner: string | null; ids: string[] }
  | { type: 'toggle'; id: string }
  | { type: 'clear' };

export const initialFavorites: FavoritesState = { ids: [], hydrated: false, owner: null };

export function favoritesReducer(state: FavoritesState, action: FavoritesAction): FavoritesState {
  switch (action.type) {
    case 'switch':
      // เปลี่ยนบัญชี: ทิ้งรายการของบัญชีเดิม รอโหลดของบัญชีใหม่
      return action.owner === state.owner ? state : { ids: [], hydrated: false, owner: action.owner };
    case 'hydrate':
      // ผลโหลดของบัญชีที่สลับออกไปแล้ว ไม่ต้องใช้
      if (action.owner !== state.owner) return state;
      // ถ้าผู้ใช้กดบันทึกก่อนโหลดเสร็จ รวมทั้งสองชุดไว้ ไม่ทิ้งสิ่งที่เพิ่งกด
      return { ...state, ids: [...new Set([...action.ids, ...state.ids])], hydrated: true };
    case 'toggle':
      return {
        ...state,
        ids: state.ids.includes(action.id) ? state.ids.filter((id) => id !== action.id) : [...state.ids, action.id],
      };
    case 'clear':
      return { ...state, ids: [] };
  }
}
