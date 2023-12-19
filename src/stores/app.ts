import { atomWithStorage } from 'jotai/utils';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { debounce } from '@/utils';

type AppState = {
  size: number;
};

type AppAction = {
  setSize: (size: number) => void;
};

type AppStore = AppState & AppAction;

export const useAppStore = create<AppStore>()(
  persist<AppStore>(
    (set, _get) => ({
      size: 300,
      setSize: debounce((size) => set((_) => ({ size }))),
    }),
    {
      name: 'app',
    },
  ),
);

export const sizeAtom = atomWithStorage('layout', 300, undefined, {
  getOnInit: true,
});
