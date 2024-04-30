import { relaunch } from '@tauri-apps/plugin-process';
import { check } from '@tauri-apps/plugin-updater';
import { Provider, useAtomValue } from 'jotai';
import { DevTools } from 'jotai-devtools';
import { useEffect } from 'react';

import {
  autoUpdateAtom,
  mainFontFamilyAtom,
  tableFontFamilyAtom,
  useSettingStore,
} from '@/stores/setting';

import { Toaster } from '@/components/ui/sonner';
import { atomStore } from '@/stores';
import 'jotai-devtools/styles.css';
import Home from './Home';
import { ThemeProvider } from './hooks/theme-provider';

function App() {
  const proxy = useSettingStore((state) => state.proxy);

  const tableFontFamily = useAtomValue(tableFontFamilyAtom);
  const mainFontFamily = useAtomValue(mainFontFamilyAtom);
  const autoUpdate = useAtomValue(autoUpdateAtom);

  useEffect(() => {
    const rootElement = document.documentElement;

    rootElement.style.setProperty('--table-font-family', tableFontFamily);
    rootElement.style.setProperty('--main-font-family', mainFontFamily);
  }, [tableFontFamily]);

  useEffect(() => {
    if (autoUpdate) {
      (async () => {
        const update = await check({ proxy });
        console.log(update);
        if (update?.version != update?.currentVersion) {
          await update?.downloadAndInstall(async (e) => {
            console.log(e);
          });
          await relaunch();
        }
      })();
    }
  }, []);

  return (
    <Provider store={atomStore}>
      <ThemeProvider>
        <DevTools position="bottom-right" />
        <Home />
        <Toaster richColors />
      </ThemeProvider>
    </Provider>
  );
}

export default App;
