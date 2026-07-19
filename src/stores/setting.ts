import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { useShallow } from 'zustand/shallow';

import { useTheme } from '@/hooks/theme-provider';
import { tauriFileStorage } from '@/stores/tauriStore';
import { createSelectors } from '@/stores/utils';
import { isDarkTheme } from '@/utils';

export type CsvParam = {
  delim?: string;
  escape?: string;
  new_line?: string;
  quote?: string;
};

export type SqlFormatterEngine = 'sql-formatter' | 'holywell' | 'shandy-sqlfmt';

export type SqlCaseOption = 'preserve' | 'upper' | 'lower';
export type SqlIndentStyle = 'standard' | 'tabularLeft' | 'tabularRight';
export type SqlLogicalNewline = 'before' | 'after';

/** Options for the built-in `sql-formatter` engine. */
export type SqlFormatterOptions = {
  tabWidth: number;
  useTabs: boolean;
  keywordCase: SqlCaseOption;
  identifierCase: SqlCaseOption;
  dataTypeCase: SqlCaseOption;
  functionCase: SqlCaseOption;
  indentStyle: SqlIndentStyle;
  logicalOperatorNewline: SqlLogicalNewline;
  expressionWidth: number;
  linesBetweenQueries: number;
  denseOperators: boolean;
  newlineBeforeSemicolon: boolean;
};

/** Options for the `holywell` engine. */
export type HolywellOptions = {
  maxLineLength: number;
  recover: boolean;
};

export type SqlfmtDialect = 'polyglot' | 'clickhouse';

/** Options for the external `shandy-sqlfmt` CLI. */
export type SqlfmtOptions = {
  /** Absolute path to `sqlfmt`; empty = look up on PATH. */
  path: string;
  lineLength: number;
  dialect: SqlfmtDialect;
};

/** App updater endpoint preset (see `tauri.conf.json` plugins.updater.endpoints). */
export type UpdaterSource = 'official' | 'china';

/** Persisted UI language preference. `system` follows OS locale with English fallback. */
export type LocalePreference = 'system' | 'en' | 'zh-CN';

export const UPDATER_ENDPOINT_OFFICIAL =
  'https://github.com/l1xnan/duckling/releases/latest/download/latest.json';

export const UPDATER_ENDPOINT_CHINA =
  'https://gh-proxy.com/github.com/l1xnan/duckling/releases/latest/download/latest.json';

export const updaterSources: {
  id: UpdaterSource;
  name: MessageDescriptor;
  description: MessageDescriptor;
  url: string;
}[] = [
  {
    id: 'official',
    name: msg`GitHub (Official)`,
    description: msg`Official GitHub Releases endpoint`,
    url: UPDATER_ENDPOINT_OFFICIAL,
  },
  {
    id: 'china',
    name: msg`China Mirror`,
    description: msg`gh-proxy.com mirror for mainland China`,
    url: UPDATER_ENDPOINT_CHINA,
  },
];

export function updaterEndpointForSource(source?: UpdaterSource | null): string {
  return source === 'china' ? UPDATER_ENDPOINT_CHINA : UPDATER_ENDPOINT_OFFICIAL;
}

export type SettingState = {
  precision: number;
  table_font_family: string;
  main_font_family: string;
  /** Font family for Monaco / SQL code editors. */
  code_font_family?: string;
  /** Font size (px) for the data table canvas renderer. */
  table_font_size?: number;
  /** Font size (px) for Monaco / SQL code editors. */
  code_font_size?: number;
  table_render: string;
  auto_update?: boolean;
  proxy?: string;
  debug?: string;
  /** UI language: follow system, or a fixed supported locale. */
  locale?: LocalePreference;
  /** Updater endpoint source: official GitHub or China mirror. */
  updater_source?: UpdaterSource;
  csv?: CsvParam;
  /**
   * Idle minutes before a live DB session is dropped (MySQL/PG pool, SSH tunnel, …).
   * `0` disables automatic eviction. Default 15.
   */
  session_idle_ttl_minutes?: number;
  /** SQL formatting engine used by the Monaco editor. */
  sql_formatter_engine?: SqlFormatterEngine;
  /**
   * @deprecated Prefer `sqlfmt_options.path`. Kept for persisted settings migration.
   */
  sqlfmt_path?: string;
  sql_formatter_options?: Partial<SqlFormatterOptions>;
  holywell_options?: Partial<HolywellOptions>;
  sqlfmt_options?: Partial<SqlfmtOptions>;
  editor_theme: {
    dark: string;
    light: string;
  };
};

export const defaultSqlFormatterOptions: SqlFormatterOptions = {
  tabWidth: 2,
  useTabs: false,
  keywordCase: 'upper',
  identifierCase: 'preserve',
  dataTypeCase: 'upper',
  functionCase: 'upper',
  indentStyle: 'standard',
  logicalOperatorNewline: 'before',
  expressionWidth: 50,
  linesBetweenQueries: 1,
  denseOperators: false,
  newlineBeforeSemicolon: false,
};

export const defaultHolywellOptions: HolywellOptions = {
  maxLineLength: 80,
  recover: true,
};

export const defaultSqlfmtOptions: SqlfmtOptions = {
  path: '',
  lineLength: 88,
  dialect: 'polyglot',
};

/** Default idle session timeout in minutes (matches backend DEFAULT_IDLE_TTL). */
export const DEFAULT_SESSION_IDLE_TTL_MINUTES = 15;

export const defaultSettings: SettingState = {
  precision: 4,
  auto_update: false,
  locale: 'system',
  updater_source: 'official',
  session_idle_ttl_minutes: DEFAULT_SESSION_IDLE_TTL_MINUTES,
  table_font_family: 'Consolas',
  table_font_size: 12,
  table_render: 'canvas',
  code_font_family: "Consolas, 'Courier New', monospace",
  code_font_size: 13,
  main_font_family: [
    '-apple-system, BlinkMacSystemFont, PingFang SC, Hiragino Sans GB',
    'Segoe WPC, Segoe UI, Microsoft YaHei',
    'system-ui,Ubuntu, Droid Sans,Source Han Sans SC, Source Han Sans CN, Source Han Sans',
    'sans-serif',
  ].join(','),
  csv: {},
  sql_formatter_engine: 'sql-formatter',
  sqlfmt_path: '',
  sql_formatter_options: defaultSqlFormatterOptions,
  holywell_options: defaultHolywellOptions,
  sqlfmt_options: defaultSqlfmtOptions,
  editor_theme: {
    light: 'vitesse-light',
    dark: 'vitesse-dark',
  },
};

export function resolveSqlFormatterOptions(
  partial?: Partial<SqlFormatterOptions> | null,
): SqlFormatterOptions {
  return { ...defaultSqlFormatterOptions, ...partial };
}

export function resolveHolywellOptions(
  partial?: Partial<HolywellOptions> | null,
): HolywellOptions {
  return { ...defaultHolywellOptions, ...partial };
}

export function resolveSqlfmtOptions(
  state: Pick<SettingState, 'sqlfmt_options' | 'sqlfmt_path'>,
): SqlfmtOptions {
  return {
    ...defaultSqlfmtOptions,
    ...state.sqlfmt_options,
    path: state.sqlfmt_options?.path ?? state.sqlfmt_path ?? '',
  };
}

export const store = create<SettingState>()(
  persist((_) => defaultSettings, {
    name: 'setting',
    // Persist to app data dir settings.json (Tauri); falls back to localStorage on web.
    storage: createJSONStorage(() => tauriFileStorage),
  }),
);

export const useSettingStore = createSelectors(store);

/** Replace jotai settingAtom — subscribe to full settings snapshot. */
export function useSettings() {
  return useSettingStore();
}

export function setSettings(
  partial:
    | Partial<SettingState>
    | ((prev: SettingState) => Partial<SettingState> | SettingState),
) {
  if (typeof partial === 'function') {
    useSettingStore.setState((s) => {
      const next = partial(s);
      return { ...s, ...next };
    });
  } else {
    useSettingStore.setState(partial);
  }
}

export function resolveSessionIdleTtlMinutes(
  value: number | undefined | null,
): number {
  if (value == null || !Number.isFinite(value)) {
    return DEFAULT_SESSION_IDLE_TTL_MINUTES;
  }
  // 0 = never; otherwise clamp 1–24h in minutes
  if (value <= 0) return 0;
  return Math.min(24 * 60, Math.max(1, Math.round(value)));
}

export function sessionIdleTtlMinutesToSecs(
  minutes: number | undefined | null,
): number {
  const m = resolveSessionIdleTtlMinutes(minutes);
  return m <= 0 ? 0 : m * 60;
}

export const usePrecision = () =>
  useSettingStore((s) => s.precision ?? defaultSettings.precision);

export const useTableFontFamily = () =>
  useSettingStore(
    (s) => s.table_font_family ?? defaultSettings.table_font_family,
  );

export const useTableFontSize = () =>
  useSettingStore(
    (s) => s.table_font_size ?? defaultSettings.table_font_size!,
  );

export const useMainFontFamily = () =>
  useSettingStore(
    (s) => s.main_font_family ?? defaultSettings.main_font_family,
  );

export const useCodeFontFamily = () =>
  useSettingStore(
    (s) => s.code_font_family ?? defaultSettings.code_font_family!,
  );

export const useCodeFontSize = () =>
  useSettingStore((s) => s.code_font_size ?? defaultSettings.code_font_size!);

export const useAutoUpdate = () => useSettingStore((s) => s.auto_update);

export const useLocalePreference = () =>
  useSettingStore((s) => s.locale ?? defaultSettings.locale!);

export const useUpdaterSource = () =>
  useSettingStore(
    (s) => s.updater_source ?? defaultSettings.updater_source!,
  );

export const useSqlFormatterEngine = () =>
  useSettingStore(
    (s) => s.sql_formatter_engine ?? defaultSettings.sql_formatter_engine!,
  );

export const useSqlfmtPath = () =>
  useSettingStore((s) => resolveSqlfmtOptions(s).path);

export const sqlFormatterEngines: {
  name: string;
  id: SqlFormatterEngine;
  description: MessageDescriptor;
}[] = [
  {
    name: 'sql-formatter',
    id: 'sql-formatter',
    description: msg`General-purpose SQL formatter`,
  },
  {
    name: 'holywell',
    id: 'holywell',
    description: msg`Simon Holywell's sqlstyle.guide (river alignment)`,
  },
  {
    name: 'shandy-sqlfmt',
    id: 'shandy-sqlfmt',
    description: msg`External sqlfmt CLI (dbt-oriented, via Tauri)`,
  },
];

export const sqlCaseOptions: { label: MessageDescriptor; value: SqlCaseOption }[] = [
  { label: msg`Upper`, value: 'upper' },
  { label: msg`Lower`, value: 'lower' },
  { label: msg`Preserve`, value: 'preserve' },
];

export const sqlIndentStyleOptions: {
  label: MessageDescriptor;
  value: SqlIndentStyle;
}[] = [
  { label: msg`Standard`, value: 'standard' },
  { label: msg`Tabular left`, value: 'tabularLeft' },
  { label: msg`Tabular right`, value: 'tabularRight' },
];

export const sqlLogicalNewlineOptions: {
  label: MessageDescriptor;
  value: SqlLogicalNewline;
}[] = [
  { label: msg`Before operator`, value: 'before' },
  { label: msg`After operator`, value: 'after' },
];

export const sqlfmtDialectOptions: {
  label: MessageDescriptor;
  value: SqlfmtDialect;
}[] = [
  { label: msg`Polyglot (default)`, value: 'polyglot' },
  { label: msg`ClickHouse`, value: 'clickhouse' },
];

export const useEditorTheme = () => {
  const theme = useTheme();
  const { light, dark } = useSettingStore(
    useShallow((s) => ({
      light:
        s.editor_theme?.light ?? defaultSettings.editor_theme?.light ?? '',
      dark: s.editor_theme?.dark ?? defaultSettings.editor_theme?.dark ?? '',
    })),
  );
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
