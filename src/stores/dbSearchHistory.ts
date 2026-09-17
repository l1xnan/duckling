import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export const MAX_DB_SEARCH_HISTORY = 8;

type DbSearchHistoryState = {
  terms: string[];
  push: (term: string) => void;
  remove: (term: string) => void;
  clear: () => void;
};

export const useDbSearchHistoryStore = create<DbSearchHistoryState>()(
  persist(
    (set) => ({
      terms: [],
      push: (term) =>
        set((s) => {
          const text = term.trim();
          if (!text) {
            return {};
          }
          return {
            terms: [text, ...s.terms.filter((t) => t !== text)].slice(
              0,
              MAX_DB_SEARCH_HISTORY,
            ),
          };
        }),
      remove: (term) =>
        set((s) => ({ terms: s.terms.filter((t) => t !== term) })),
      clear: () => set({ terms: [] }),
    }),
    {
      name: 'db-search-history',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
