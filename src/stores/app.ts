import { focusAtom } from 'jotai-optics';
import { atomWithStore } from 'jotai-zustand';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { createSelectors } from '@/stores/utils';
import { debounce } from '@/utils';

type AppState = {
  size: number;
};

type AppAction = {
  setSize: (size: number) => void;
};

type AppStore = AppState & AppAction;

export const store = create<AppStore>()(
  persist<AppStore>(
    (set, _get) => ({
      size: 300,
      setSize: debounce<(size: number) => void>((size) =>
        set((_) => ({ size })),
      ),
    }),
    {
      name: 'app',
    },
  ),
);

const useAppStore = createSelectors(store);

export const appAtom = atomWithStore(useAppStore);

export const sizeAtom = focusAtom(appAtom, (optic) => optic.prop('size'));
