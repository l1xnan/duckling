import { CssBaseline } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLocalStorageState } from 'ahooks';
import { DevTools } from 'jotai-devtools';
import { useMemo } from 'react';

import Home from './Home';
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
