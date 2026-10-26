import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export const MAX_TERM_HISTORY = 8;

export type TermHistoryState = {
  terms: string[];
  push: (term: string) => void;
  remove: (term: string) => void;
  clear: () => void;
};

export function createTermHistoryStore(storageName: string) {
  return create<TermHistoryState>()(
    persist(
      (set) => ({
        terms: [],
        push: (term) => {
          const text = term.trim();
          if (!text) {
            return;
          }
          set((s) => ({
            terms: [text, ...s.terms.filter((t) => t !== text)].slice(
              0,
              MAX_TERM_HISTORY,
            ),
          }));
        },
        remove: (term) =>
          set((s) => ({ terms: s.terms.filter((t) => t !== term) })),
        clear: () => set({ terms: [] }),
      }),
      {
        name: storageName,
        storage: createJSONStorage(() => localStorage),
      },
    ),
  );
}
