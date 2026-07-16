import { relaunch } from '@tauri-apps/plugin-process';
import { Provider, useAtomValue } from 'jotai';
import { DevTools, DevToolsProps } from 'jotai-devtools';
import css from 'jotai-devtools/styles.css?inline';
import { useEffect } from 'react';

import { checkAppUpdate } from '@/api';
import { Toaster } from '@/components/ui/sonner';
import { atomStore } from '@/stores';
import {
  autoUpdateAtom,
  mainFontFamilyAtom,
  tableFontFamilyAtom,
  useSettingStore,
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
  const tableFontFamily = useAtomValue(tableFontFamilyAtom);
  const mainFontFamily = useAtomValue(mainFontFamilyAtom);
  const autoUpdate = useAtomValue(autoUpdateAtom);

  useEffect(() => {
    const rootElement = document.documentElement;

    rootElement.style.setProperty('--table-font-family', tableFontFamily);
    rootElement.style.setProperty('--main-font-family', mainFontFamily);
  }, [tableFontFamily, mainFontFamily]);

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
      <ThemeProvider>
        <JotaiDevTools position="bottom-right" />
        <Home />

        <Toaster richColors />
      </ThemeProvider>
    </Provider>
  );
}

export default App;
