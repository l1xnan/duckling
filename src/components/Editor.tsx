import CodeMirror from "@uiw/react-codemirror";
import { sql } from "@codemirror/lang-sql";
import { useCallback, useState } from "react";
import { Box, IconButton } from "@mui/material";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";
import { ToolbarContainer } from "./Toolbar";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";

export default function Editor() {
  const [value, setValue] = useState(`select * from demo`);
  const onChange = useCallback((val, viewUpdate) => {
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
