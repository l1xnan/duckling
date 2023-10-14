import { Button, CssBaseline } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import * as dialog from "@tauri-apps/plugin-dialog";
// @ts-ignore
import { Table, tableFromIPC } from "apache-arrow";
import { useMemo, useState } from "react";

import { ColorModeContext, darkTheme, lightTheme } from "./theme";
import Database from "./Database";
import { useLocalStorageState } from "ahooks";

interface ValidationResponse {
  row_count: number;
  preview: Array<number>;
}

const DialogButton = () => {
  return (
    <Button
      onClick={async () => {
        const res = await dialog.open({
          directory: true,
        });
        if (res) {
          // openDirectory(res);
        }
      }}
    >
      Open
    </Button>
  );
};

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
        <Database />
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}

export default App;
