import { atomWithStore } from 'jotai-zustand';
// eslint-disable-next-line import/order
import { selectAtom } from 'jotai/utils';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type SettingState = {
  precision?: number;
  table_font_family?: string;
  auto_update?: boolean;
  proxy?: string;
};

export const useSettingStore = create<SettingState>()(
  persist(
    (_) => ({
      precision: 4,
      auto_update: true,
    }),
    {
      name: 'settingStore',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

export const settingAtom = atomWithStore(useSettingStore);

export const precisionAtom = selectAtom(settingAtom, (s) => s.precision);
export const tableFontFamilyAtom = selectAtom(
  settingAtom,
  (s) => s.table_font_family,
);
