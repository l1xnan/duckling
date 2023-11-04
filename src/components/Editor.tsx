import CodeMirror, { ViewUpdate } from "@uiw/react-codemirror";
import { sql } from "@codemirror/lang-sql";
import { useCallback, useState } from "react";
import { Box, IconButton } from "@mui/material";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";
import { ToolbarContainer } from "./Toolbar";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import { query } from "@/api";

export default function Editor() {
  const [value, setValue] = useState(`select * from demo`);
  const onChange = useCallback((val: string, viewUpdate: ViewUpdate) => {
    console.log("val:", val);
    setValue(val);
  }, []);

  return (
    <Box
      sx={{
        height: "calc(100vh - 32px)",
        "& .cm-editor .cm-content": { fontFamily: "Consolas" },
      }}
    >
      <ToolbarContainer>
        <IconButton
          size="small"
          sx={{
            color: "green",
          }}
          onClick={async () => {
            const data = await query({
              sql: value,
              path: ":memory:",
              limit: 500,
              offset: 1,
            });
          }}
        >
          <PlayArrowIcon fontSize="inherit" />
        </IconButton>
      </ToolbarContainer>
      <CodeMirror
        value={value}
        height="calc(100vh - 32px)"
        extensions={[sql({})]}
        theme={vscodeDark}
        onChange={onChange}
      />
    </Box>
  );
}
