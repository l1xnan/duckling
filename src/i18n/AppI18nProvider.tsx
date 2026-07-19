import { I18nProvider } from '@lingui/react';
import { PropsWithChildren, useEffect, useState } from 'react';

import { activateLocale, i18n, resolveLocale } from '@/i18n';
import { useLocalePreference } from '@/stores/setting';

/**
 * Keeps Lingui catalog in sync with the persisted language preference
 * (including `system` → OS locale with English fallback).
 */
export function AppI18nProvider({ children }: PropsWithChildren) {
  const preference = useLocalePreference();
  const [ready, setReady] = useState(() => i18n.locale.length > 0);

  useEffect(() => {
    let cancelled = false;
    const locale = resolveLocale(preference);
    void (async () => {
      await activateLocale(locale);
      if (!cancelled) {
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [preference]);

  if (!ready) {
    return null;
  }

  return <I18nProvider i18n={i18n}>{children}</I18nProvider>;
}
