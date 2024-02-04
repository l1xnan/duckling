import { CssBaseline } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import { useAtom, useAtomValue } from 'jotai';
import { DevTools } from 'jotai-devtools';
// eslint-disable-next-line import/order
import { atomWithStorage } from 'jotai/utils';
import { useEffect, useMemo } from 'react';

import { mainFontFamilyAtom, tableFontFamilyAtom } from '@/stores/setting';

import Home from './Home';
import { Toaster } from './components/ui/sonner';
import { ColorModeContext, darkTheme, lightTheme } from './theme';

export const themeAtom = atomWithStorage<ThemeType>('mode', 'light');

type ThemeType = 'light' | 'dark' | 'system';

function App() {
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

  return (
    <>
      <DevTools />
      <ColorModeContext.Provider value={colorMode}>
        <ThemeProvider theme={theme}>
          <CssBaseline enableColorScheme />
          <Home />
          <Toaster richColors />
        </ThemeProvider>
      </ColorModeContext.Provider>
    </>
  );
}

export default App;
