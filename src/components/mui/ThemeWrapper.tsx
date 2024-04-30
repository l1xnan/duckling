import {
  ColorModeContext,
  darkTheme,
  lightTheme,
} from '@/components/mui/theme';
import { themeAtom } from '@/stores/app';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { useAtom } from 'jotai';
import { PropsWithChildren, useMemo } from 'react';

export const ThemeWrapper = ({ children }: PropsWithChildren<{}>) => {
  const [themeMode, setMode] = useAtom(themeAtom);

  const theme = useMemo(
    () => (themeMode == 'dark' ? darkTheme : lightTheme),
    [themeMode],
  );

  const colorMode = useMemo(
    () => ({
      toggleColorMode: () => {
        setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
      },
    }),
    [],
  );
  return (
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        <CssBaseline enableColorScheme />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
};
