import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export const MAX_TABLE_CLAUSE_HISTORY = 8;

function pushTerm(list: string[], term: string): string[] {
  const text = term.trim();
  if (!text) {
    return list;
  }
  return [text, ...list.filter((t) => t !== text)].slice(0, MAX_TABLE_CLAUSE_HISTORY);
}

type TableClauseHistoryState = {
  whereTerms: string[];
  orderByTerms: string[];
  pushWhere: (term: string) => void;
  pushOrderBy: (term: string) => void;
  removeWhere: (term: string) => void;
  removeOrderBy: (term: string) => void;
  clearWhere: () => void;
  clearOrderBy: () => void;
};

export const useTableClauseHistoryStore = create<TableClauseHistoryState>()(
  persist(
    (set) => ({
      whereTerms: [],
      orderByTerms: [],
      pushWhere: (term) =>
        set((s) => ({ whereTerms: pushTerm(s.whereTerms, term) })),
      pushOrderBy: (term) =>
        set((s) => ({ orderByTerms: pushTerm(s.orderByTerms, term) })),
      removeWhere: (term) =>
        set((s) => ({
          whereTerms: s.whereTerms.filter((t) => t !== term),
        })),
      removeOrderBy: (term) =>
        set((s) => ({
          orderByTerms: s.orderByTerms.filter((t) => t !== term),
        })),
      clearWhere: () => set({ whereTerms: [] }),
      clearOrderBy: () => set({ orderByTerms: [] }),
    }),
    {
      name: 'table-clause-history',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
