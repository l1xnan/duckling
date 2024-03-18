import { CssBaseline } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import { relaunch } from '@tauri-apps/plugin-process';
import { check } from '@tauri-apps/plugin-updater';
import { Provider, useAtom, useAtomValue } from 'jotai';
import { DevTools } from 'jotai-devtools';
import { atomWithStorage } from 'jotai/utils';
import { useEffect, useMemo } from 'react';

import {
  autoUpdateAtom,
  mainFontFamilyAtom,
  tableFontFamilyAtom,
  useSettingStore,
} from '@/stores/setting';

import Home from './Home';
import { Toaster } from './components/ui/sonner';
import { atomStore } from './stores';
import { ColorModeContext, darkTheme, lightTheme } from './theme';

export const themeAtom = atomWithStorage<ThemeType>('mode', 'light');

type ThemeType = 'light' | 'dark' | 'system';

const isDev = import.meta.env.MODE === 'development';

function App() {
  const proxy = useSettingStore((state) => state.proxy);

  const [themeMode, setMode] = useAtom(themeAtom);
  const colorMode = useMemo(
    () => ({
      toggleColorMode: () => {
        setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
      },
    }),
    [],
  );

  const theme = useMemo(
    () => (themeMode == 'dark' ? darkTheme : lightTheme),
    [themeMode],
  );

  const tableFontFamily = useAtomValue(tableFontFamilyAtom);
  const mainFontFamily = useAtomValue(mainFontFamilyAtom);
  const autoUpdate = useAtomValue(autoUpdateAtom);

  useEffect(() => {
    const root = window.document.documentElement;

    root.classList.remove('light', 'dark');

    if (themeMode === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
        .matches
        ? 'dark'
        : 'light';

      root.classList.add(systemTheme);
      return;
    }

    root.classList.add(themeMode);
  }, [themeMode]);

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
      <DevTools />
      <ColorModeContext.Provider value={colorMode}>
        <ThemeProvider theme={theme}>
          <CssBaseline enableColorScheme />
          <Home />
          <Toaster richColors />
        </ThemeProvider>
      </ColorModeContext.Provider>
    </Provider>
  );
}

export default App;
