import { useTheme } from '@/hooks/theme-provider';
import { createSelectors } from '@/stores/utils';
import { isDarkTheme } from '@/utils';
import { useAtomValue } from 'jotai';
import { atomWithStore } from 'jotai-zustand';
import { selectAtom } from 'jotai/utils';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type CsvParam = {
  delim?: string;
  escape?: string;
  new_line?: string;
  quote?: string;
};

export type SettingState = {
  precision: number;
  table_font_family: string;
  main_font_family: string;
  table_render: string;
  auto_update?: boolean;
  proxy?: string;
  debug?: string;
  csv?: CsvParam;
  editor_theme: {
    dark: string;
    light: string;
  };
};

export const defaultSettings = {
  precision: 4,
  auto_update: false,
  table_font_family: 'Consolas',
  table_render: 'canvas',
  main_font_family: [
    '-apple-system, BlinkMacSystemFont, PingFang SC, Hiragino Sans GB',
    'Segoe WPC, Segoe UI, Microsoft YaHei',
    'system-ui,Ubuntu, Droid Sans,Source Han Sans SC, Source Han Sans CN, Source Han Sans',
    'sans-serif',
  ].join(','),
  csv: {},
  editor_theme: {
    light: 'vitesse-light',
    dark: 'vitesse-dark',
  },
};

export const store = create<SettingState>()(
  persist((_) => defaultSettings, {
    name: 'setting',
    storage: createJSONStorage(() => localStorage),
  }),
);

export const useSettingStore = createSelectors(store);

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

export const editorThemeAtom = selectAtom(settingAtom, (s) => ({
  ...defaultSettings['editor_theme'],
  ...s.editor_theme,
}));

export const autoUpdateAtom = selectAtom(settingAtom, (s) => s.auto_update);

export const useEditorTheme = () => {
  const theme = useTheme();
  const { light, dark } = useAtomValue(editorThemeAtom);
  return isDarkTheme(theme) ? dark : light;
};

export const editorThemes = [
  { name: 'Andromeeda', id: 'andromeeda', type: 'dark' },
  { name: 'Aurora X', id: 'aurora-x', type: 'dark' },
  { name: 'Ayu Dark', id: 'ayu-dark', type: 'dark' },
  { name: 'Catppuccin Frappé', id: 'catppuccin-frappe', type: 'dark' },
  { name: 'Catppuccin Latte', id: 'catppuccin-latte', type: 'light' },
  { name: 'Catppuccin Macchiato', id: 'catppuccin-macchiato', type: 'dark' },
  { name: 'Catppuccin Mocha', id: 'catppuccin-mocha', type: 'dark' },
  { name: 'Dark Plus', id: 'dark-plus', type: 'dark' },
  { name: 'Dracula Theme', id: 'dracula', type: 'dark' },
  { name: 'Dracula Theme Soft', id: 'dracula-soft', type: 'dark' },
  { name: 'Everforest Dark', id: 'everforest-dark', type: 'dark' },
  { name: 'Everforest Light', id: 'everforest-light', type: 'light' },
  { name: 'GitHub Dark', id: 'github-dark', type: 'dark' },
  { name: 'GitHub Dark Default', id: 'github-dark-default', type: 'dark' },
  { name: 'GitHub Dark Dimmed', id: 'github-dark-dimmed', type: 'dark' },
  {
    name: 'GitHub Dark High Contrast',
    id: 'github-dark-high-contrast',
    type: 'dark',
  },
  { name: 'GitHub Light', id: 'github-light', type: 'light' },
  { name: 'GitHub Light Default', id: 'github-light-default', type: 'light' },
  {
    name: 'GitHub Light High Contrast',
    id: 'github-light-high-contrast',
    type: 'light',
  },
  { name: 'Gruvbox Dark Hard', id: 'gruvbox-dark-hard', type: 'dark' },
  { name: 'Gruvbox Dark Medium', id: 'gruvbox-dark-medium', type: 'dark' },
  { name: 'Gruvbox Dark Soft', id: 'gruvbox-dark-soft', type: 'dark' },
  { name: 'Gruvbox Light Hard', id: 'gruvbox-light-hard', type: 'light' },
  { name: 'Gruvbox Light Medium', id: 'gruvbox-light-medium', type: 'light' },
  { name: 'Gruvbox Light Soft', id: 'gruvbox-light-soft', type: 'light' },
  { name: 'Houston', id: 'houston', type: 'dark' },
  { name: 'Kanagawa Dragon', id: 'kanagawa-dragon', type: 'dark' },
  { name: 'Kanagawa Lotus', id: 'kanagawa-lotus', type: 'light' },
  { name: 'Kanagawa Wave', id: 'kanagawa-wave', type: 'dark' },
  { name: 'LaserWave', id: 'laserwave', type: 'dark' },
  { name: 'Light Plus', id: 'light-plus', type: 'light' },
  { name: 'Material Theme', id: 'material-theme', type: 'dark' },
  { name: 'Material Theme Darker', id: 'material-theme-darker', type: 'dark' },
  {
    name: 'Material Theme Lighter',
    id: 'material-theme-lighter',
    type: 'light',
  },
  { name: 'Material Theme Ocean', id: 'material-theme-ocean', type: 'dark' },
  {
    name: 'Material Theme Palenight',
    id: 'material-theme-palenight',
    type: 'dark',
  },
  { name: 'Min Dark', id: 'min-dark', type: 'dark' },
  { name: 'Min Light', id: 'min-light', type: 'light' },
  { name: 'Monokai', id: 'monokai', type: 'dark' },
  { name: 'Night Owl', id: 'night-owl', type: 'dark' },
  { name: 'Nord', id: 'nord', type: 'dark' },
  { name: 'One Dark Pro', id: 'one-dark-pro', type: 'dark' },
  { name: 'One Light', id: 'one-light', type: 'light' },
  { name: 'Plastic', id: 'plastic', type: 'light' },
  { name: 'Poimandres', id: 'poimandres', type: 'dark' },
  { name: 'Red', id: 'red', type: 'dark' },
  { name: 'Rosé Pine', id: 'rose-pine', type: 'dark' },
  { name: 'Rosé Pine Dawn', id: 'rose-pine-dawn', type: 'light' },
  { name: 'Rosé Pine Moon', id: 'rose-pine-moon', type: 'dark' },
  { name: 'Slack Dark', id: 'slack-dark', type: 'dark' },
  { name: 'Slack Ochin', id: 'slack-ochin', type: 'dark' },
  { name: 'Snazzy Light', id: 'snazzy-light', type: 'light' },
  { name: 'Solarized Dark', id: 'solarized-dark', type: 'dark' },
  { name: 'Solarized Light', id: 'solarized-light', type: 'light' },
  { name: "Synthwave '84", id: 'synthwave-84', type: 'dark' },
  { name: 'Tokyo Night', id: 'tokyo-night', type: 'dark' },
  { name: 'Vesper', id: 'vesper', type: 'dark' },
  { name: 'Vitesse Black', id: 'vitesse-black', type: 'dark' },
  { name: 'Vitesse Dark', id: 'vitesse-dark', type: 'dark' },
  { name: 'Vitesse Light', id: 'vitesse-light', type: 'light' },
];
