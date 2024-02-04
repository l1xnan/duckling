import { atomWithStore } from 'jotai-zustand';
// eslint-disable-next-line import/order
import { selectAtom } from 'jotai/utils';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type SettingState = {
  precision: number;
  table_font_family: string;
  main_font_family: string;
  auto_update?: boolean;
  proxy?: string;
};

export const defaultSettings = {
  precision: 4,
  auto_update: true,
  table_font_family: 'Consolas',
  main_font_family: [
    '-apple-system, BlinkMacSystemFont, PingFang SC, Hiragino Sans GB',
    'Segoe WPC, Segoe UI, Microsoft YaHei',
    'system-ui,Ubuntu, Droid Sans,Source Han Sans SC, Source Han Sans CN, Source Han Sans',
    'sans-serif',
  ].join(','),
};
export const useSettingStore = create<SettingState>()(
  persist((_) => defaultSettings, {
    name: 'settingStore',
    storage: createJSONStorage(() => localStorage),
  }),
);

export const settingAtom = atomWithStore(useSettingStore);

export const precisionAtom = selectAtom(
  settingAtom,
  (s) => s.precision ?? defaultSettings['precision'],
);
export const tableFontFamilyAtom = selectAtom(
  settingAtom,
  (s) => s.table_font_family ?? defaultSettings['table_font_family'],
);
export const mainFontFamilyAtom = selectAtom(
  settingAtom,
  (s) => s.main_font_family ?? defaultSettings['main_font_family'],
);
