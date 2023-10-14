import { CssBaseline } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import { useMemo } from "react";

import { useLocalStorageState } from "ahooks";
import Home from "./Home";
import { ColorModeContext, darkTheme, lightTheme } from "./theme";

function App() {
  const [mode, setMode] = useLocalStorageState<"light" | "dark">("mode", {
    defaultValue: "light",
  });
  const colorMode = useMemo(
    () => ({
      toggleColorMode: () => {
        setMode((prevMode) => (prevMode === "light" ? "dark" : "light"));
      },
    }),
    []
  );

  const theme = useMemo(
    () => (mode == "dark" ? darkTheme : lightTheme),
    [mode]
  );

  return (
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        <CssBaseline enableColorScheme />
        <Home />
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}

export default App;
