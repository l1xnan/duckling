import CodeMirror, { ViewUpdate } from "@uiw/react-codemirror";
import { sql } from "@codemirror/lang-sql";
import { useCallback, useState } from "react";
import { Box, IconButton } from "@mui/material";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";
import { ToolbarContainer } from "../../components/Toolbar";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import classes from "@/hooks/resize.module.css";
import { usePageStore } from "@/stores/store";
import { useTabsStore } from "@/stores/tabs";
import { basicLight, vscodeDark } from "@uiw/codemirror-themes-all";
import { isDarkTheme } from "@/utils";

import DatasetItem from "./DatasetItem";
import { useResize } from "@/hooks";

export default function Editor() {
  const { table, refresh } = usePageStore();
  const id = table?.id!;
  const setStmt = useTabsStore((state) => state.setStmt);
  const docs = useTabsStore((state) => state.docs);
  const stmt = docs[id];

  const onChange = useCallback((val: string, _viewUpdate: ViewUpdate) => {
    setStmt(id, val);
  }, []);

  const [targetRefTop, sizeTop, actionTop] = useResize(300, "bottom");

  const theme = useTheme();
  return (
    <Box
      sx={{
        height: "calc(100vh - 32px)",
        "& .cm-editor .cm-content": { fontFamily: "Consolas" },
        "& *": { fontFamily: "Consolas" },
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      <Box sx={{ height: "100%" }}>
        <ToolbarContainer>
          <IconButton
            size="small"
            sx={{
              color: "green",
            }}
            onClick={async () => {
              if (stmt) {
                await refresh(stmt);
              }
            }}
          >
            <PlayArrowIcon fontSize="inherit" />
          </IconButton>
        </ToolbarContainer>
        <CodeMirror
          value={stmt}
          height={`calc(100vh - ${sizeTop + 64}px)`}
          extensions={[sql(), sqlSnippets]}
          theme={isDarkTheme(theme) ? vscodeDark : basicLight}
          onChange={onChange}
        />
      </Box>
      <Box
        ref={targetRefTop}
        className={classes.rightBottom}
        sx={{ height: sizeTop + "px", width: "100%" }}
      >
        <div className={classes.controlsH}>
          <div className={classes.resizeHorizontal} onMouseDown={actionTop} />
        </div>
        <DatasetItem />
      </Box>
    </Box>
  );
}
