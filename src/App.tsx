import { relaunch } from '@tauri-apps/plugin-process';
import { Provider } from 'jotai';
import { DevTools, DevToolsProps } from 'jotai-devtools';
import css from 'jotai-devtools/styles.css?inline';
import { useEffect } from 'react';

import { checkAppUpdate, setSessionIdleTtl } from '@/api';
import { Toaster } from '@/components/ui/sonner';
import { HotkeysRoot } from '@/hotkeys';
import { AppI18nProvider } from '@/i18n/AppI18nProvider';
import { atomStore } from '@/stores';
import {
  sessionIdleTtlMinutesToSecs,
  useAutoUpdate,
  useMainFontFamily,
  useSettingStore,
  useTableFontFamily,
} from '@/stores/setting';

import Home from './Home';
import { ThemeProvider } from './hooks/theme-provider';

const JotaiDevTools = (props: DevToolsProps) =>
  process.env.NODE_ENV !== 'production' ? (
    <>
      <style>{css}</style>
      <DevTools {...props} />
    </>
  ) : null;

function App() {
  const tableFontFamily = useTableFontFamily();
  const mainFontFamily = useMainFontFamily();
  const autoUpdate = useAutoUpdate();
  const sessionIdleTtlMinutes = useSettingStore(
    (s) => s.session_idle_ttl_minutes,
  );

  useEffect(() => {
    const rootElement = document.documentElement;

    rootElement.style.setProperty('--table-font-family', tableFontFamily);
    rootElement.style.setProperty('--main-font-family', mainFontFamily);
  }, [tableFontFamily, mainFontFamily]);

  // Sync global session idle TTL to the Rust SessionManager.
  useEffect(() => {
    const secs = sessionIdleTtlMinutesToSecs(sessionIdleTtlMinutes);
    void setSessionIdleTtl(secs).catch((err) =>
      console.warn('setSessionIdleTtl failed', err),
    );
  }, [sessionIdleTtlMinutes]);

  useEffect(() => {
    if (!autoUpdate) {
      return;
    }
    (async () => {
      const { proxy, updater_source } = useSettingStore.getState();
      const update = await checkAppUpdate({
        source: updater_source,
        proxy,
      });
      if (update?.version != update?.currentVersion) {
        await update?.downloadAndInstall(async (e) => {
          console.log(e);
        });
        await relaunch();
      }
    })();
  }, [autoUpdate]);

  return (
    <Provider store={atomStore}>
      <AppI18nProvider>
        <ThemeProvider>
          <HotkeysRoot>
            <JotaiDevTools position="bottom-right" />
            <Home />
            <Toaster richColors />
          </HotkeysRoot>
        </ThemeProvider>
      </AppI18nProvider>
    </Provider>
  );
}

export default App;
