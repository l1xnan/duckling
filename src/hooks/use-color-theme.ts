import { useTheme } from '@/hooks/theme-provider';
import {
  defaultSettings,
  useColorThemeSetting,
  useSettingStore,
} from '@/stores/setting';
import {
  getEffectiveTokens,
  THEME_TOKEN_KEYS,
  tokenToCssVarName,
  tokensForInjection,
  type ThemeTokens,
} from '@/themes/presets';
import { useEffect, useMemo } from 'react';

export type ResolvedMode = 'light' | 'dark';

export function resolveColorMode(
  theme: 'light' | 'dark' | 'system',
): ResolvedMode {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }
  return theme;
}

/** Inject (or clear) CSS custom properties on <html>. */
export function applyColorThemeToDocument(tokens: ThemeTokens | null) {
  const style = document.documentElement.style;
  for (const key of THEME_TOKEN_KEYS) {
    const prop = `--${tokenToCssVarName(key)}`;
    if (tokens) {
      style.setProperty(prop, tokens[key]);
    } else {
      style.removeProperty(prop);
    }
  }
}

export function useResolvedColorTheme() {
  const { theme } = useTheme();
  const colorTheme = useColorThemeSetting();
  const mode = useMemo(() => resolveColorMode(theme), [theme]);
  const tokens = useMemo(
    () => getEffectiveTokens(colorTheme, mode),
    [colorTheme, mode],
  );

  return {
    presetId: colorTheme?.preset ?? defaultSettings.color_theme!.preset,
    colorTheme,
    mode,
    isDark: mode === 'dark',
    tokens,
  };
}

/**
 * Mount inside ThemeProvider. Keeps document CSS variables in sync with
 * color_theme setting + light/dark mode.
 */
export function ColorThemeApplicator() {
  const { theme } = useTheme();
  const colorTheme = useSettingStore(
    (s) => s.color_theme ?? defaultSettings.color_theme,
  );

  useEffect(() => {
    const mode = resolveColorMode(theme);
    applyColorThemeToDocument(tokensForInjection(colorTheme, mode));
  }, [theme, colorTheme]);

  return null;
}
