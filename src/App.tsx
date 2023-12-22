import { CssBaseline } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLocalStorageState } from 'ahooks';
import { DevTools } from 'jotai-devtools';
import { useEffect, useMemo } from 'react';

import Home from './Home';
import { useSettingStore } from './stores/setting';
import { ColorModeContext, darkTheme, lightTheme } from './theme';

const queryClient = new QueryClient();

function App() {
  const [mode, setMode] = useLocalStorageState<'light' | 'dark'>('mode', {
    defaultValue: 'light',
  });
  const colorMode = useMemo(
    () => ({
      toggleColorMode: () => {
        setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
      },
    }),
    [],
  );

  const theme = useMemo(
    () => (mode == 'dark' ? darkTheme : lightTheme),
    [mode],
  );

  const table_font_family = useSettingStore((state) => state.table_font_family);

  useEffect(() => {
    const rootElement = document.documentElement;

    rootElement.style.setProperty(
      '--table-font-family',
      (table_font_family ?? 'Consolas') +
        `, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif`,
    );
  }, [table_font_family]);

  return (
    <>
      <DevTools />
      <QueryClientProvider client={queryClient}>
        <ColorModeContext.Provider value={colorMode}>
          <ThemeProvider theme={theme}>
            <CssBaseline enableColorScheme />
            <Home />
          </ThemeProvider>
        </ColorModeContext.Provider>
      </QueryClientProvider>
    </>
  );
}

export default App;
