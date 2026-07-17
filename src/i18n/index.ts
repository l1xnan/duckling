import { i18n } from '@lingui/core';

import { store, type LocalePreference } from '@/stores/setting';

/** Locales that have message catalogs. */
export type AppLocale = 'en' | 'zh-CN';

export const SUPPORTED_LOCALES: readonly AppLocale[] = ['en', 'zh-CN'] as const;

export const DEFAULT_LOCALE: AppLocale = 'en';

export { i18n };

export function isAppLocale(value: string): value is AppLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/**
 * Map `navigator.language` / `navigator.languages` to a supported app locale.
 * Any `zh*` tag uses `zh-CN` (only Simplified Chinese catalog in P0).
 * All other unsupported tags fall back to English.
 */
export function detectSystemLocale(): AppLocale {
  const candidates = [navigator.language, ...(navigator.languages ?? [])];

  for (const tag of candidates) {
    if (!tag) continue;
    const normalized = tag.toLowerCase().replaceAll('_', '-');

    if (normalized === 'en' || normalized.startsWith('en-')) {
      return 'en';
    }
    if (normalized === 'zh' || normalized.startsWith('zh-')) {
      return 'zh-CN';
    }
  }

  return DEFAULT_LOCALE;
}

export function resolveLocale(preference: LocalePreference | undefined | null): AppLocale {
  if (preference && preference !== 'system' && isAppLocale(preference)) {
    return preference;
  }
  return detectSystemLocale();
}

export async function activateLocale(locale: AppLocale): Promise<void> {
  const { messages } = await import(`../locales/${locale}/messages.po`);
  i18n.load(locale, messages);
  i18n.activate(locale);
  document.documentElement.lang = locale;
}

/** Resolve preference from settings (default: system) and activate the catalog. */
export async function setupI18n(): Promise<AppLocale> {
  const preference = store.getState().locale ?? 'system';
  const locale = resolveLocale(preference);
  await activateLocale(locale);
  return locale;
}
