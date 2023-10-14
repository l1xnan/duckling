import { Box, BoxProps, Button, Typography } from "@mui/material";
import { styled, useTheme } from "@mui/material/styles";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/tauri";
import * as dialog from "@tauri-apps/plugin-dialog";
// @ts-ignore
import { Table, tableFromIPC } from "apache-arrow";
import Dataset from "@/components/Dataset";
import FileTreeView, { FileNode } from "@/components/FileTree";
import { Content, Layout, Sidebar } from "@/components/Layout";
import ToggleColorMode from "@/components/ToggleColorMode";
import { isDarkTheme } from "@/utils";
import { useLocalStorageState } from "ahooks";
import { useEffect, useState } from "react";

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

function Home() {
  const theme = useTheme();
  const [folders, setFolders] = useLocalStorageState<FileNode[]>("folders", {
    defaultValue: [],
  });
  const [tableName, setTableName] = useState<string | null>(null);

  async function openDirectory(name?: string) {
    const fileTree: FileNode = await invoke("greet", { name });
    if (!!fileTree) {
      setFolders([...(folders ?? []), fileTree]);
    }
  }

  useEffect(() => {
    const unlisten = listen("open-directory", (e) => {
      console.log(e.payload);

      openDirectory(e.payload as string);
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  return (
    <Layout>
      <Sidebar>
        <ToolbarBox>
          <Typography fontWeight={800}>Database Explorer</Typography>
          <ToggleColorMode />
        </ToolbarBox>
        <Box
          sx={{
            width: "100%",
            maxHeight: "calc(100vh - 32px)",
            height: "calc(100vh - 32px)",
            overflow: "auto",
            pr: 1,
            pb: 2,
            borderRight: isDarkTheme(theme)
              ? "1px solid #1e1f22"
              : "1px solid #e2e2e2",
          }}
        >
          {folders ? (
            <FileTreeView
              data={folders}
              onNodeSelect={(_, nodeId) => {
                if (nodeId.endsWith(".parquet")) {
                  setTableName(nodeId);
                }
              }}
            />
          ) : null}
        </Box>
      </Sidebar>
      <Content>
        {tableName ? (
          <Dataset tableName={tableName} />
        ) : (
          <Box
            sx={{
              display: "flex",
              marginTop: "20%",
              height: "100%",
              justifyContent: "center",
            }}
          />
        )}
      </Content>
    </Layout>
  );
}

const ToolbarBox = styled(Box)<BoxProps>(({ theme }) => ({
  height: 32,
  width: "100%",
  paddingLeft: "1rem",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  borderBottom: isDarkTheme(theme) ? "1px solid #1e1f22" : "1px solid #e2e2e2",
}));

export default Home;
