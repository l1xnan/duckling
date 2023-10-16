import { Box, BoxProps, IconButton, Stack, Typography } from "@mui/material";
import { styled, useTheme } from "@mui/material/styles";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/tauri";
import * as dialog from "@tauri-apps/plugin-dialog";
import Dataset from "@/components/Dataset";
import FileTreeView, { FileNode } from "@/components/FileTree";
import { Content, Layout, Sidebar } from "@/components/Layout";
import ToggleColorMode from "@/components/ToggleColorMode";
import RemoveIcon from "@mui/icons-material/Remove";
import { isDarkTheme } from "@/utils";
import { useLocalStorageState } from "ahooks";
import { useEffect, useState } from "react";
import { showTables, useStore } from "@/stores/store";
import {
  IconDatabasePlus,
  IconFolderPlus,
  IconRefresh,
} from "@tabler/icons-react";

export const MuiIconButton = styled((props) => (
  <IconButton color="inherit" {...props} />
))<BoxProps>(({}) => ({
  "& *": {
    fontSize: 16,
    height: 16,
    width: 16,
  },
}));

function Home() {
  const theme = useTheme();

  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [folders, setFolders] = useLocalStorageState<FileNode[]>("folders", {
    defaultValue: [],
  });

  async function openDirectory(name?: string) {
    const fileTree: FileNode = await invoke("get_folder_tree", { name });
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
  const setStore = useStore((state) => state.setStore);
  const tableName = useStore((state) => state.tableName);
  console.log(tableName, !!tableName);
  return (
    <Layout>
      <Sidebar>
        <ToolbarBox>
          <Typography fontWeight={800}>Database Explorer</Typography>

          <Stack direction="row">
            <MuiIconButton
              onClick={async () => {
                const res = await dialog.open({
                  directory: true,
                });
                if (res) {
                  openDirectory(res);
                }
              }}
              sx={{
                "& *": {
                  fontSize: 16,
                  height: 16,
                  width: 16,
                },
              }}
            >
              <IconFolderPlus />
            </MuiIconButton>
            <MuiIconButton
              onClick={async () => {
                const res = await dialog.open({
                  directory: false,
                  filters: [
                    {
                      name: "Data File",
                      extensions: ["duckdb", "parquet", "csv"],
                    },
                  ],
                });
                if (res) {
                  openDirectory(res.path);
                }
              }}
            >
              <IconDatabasePlus />
            </MuiIconButton>
            <IconButton
              color="inherit"
              onClick={async () => {
                setFolders(
                  folders?.filter(
                    (folder) => !(folder.path === selectedPath && folder.is_dir)
                  )
                );
              }}
            >
              <RemoveIcon />
            </IconButton>
            <MuiIconButton
              color="inherit"
              onClick={async () => {
                console.log(selectedPath);
                if (selectedPath && selectedPath.endsWith(".duckdb")) {
                  const res = await showTables(selectedPath);
                  console.log(res);
                  setFolders(
                    folders?.map((item) => {
                      if (item.path == selectedPath) {
                        item.children = res.data.map(({ name }) => ({
                          name,
                          path: name,
                          type: "table",
                          children: [],
                        }));
                        return item;
                      }
                      return item;
                    })
                  );
                  console.log(folders);
                }
              }}
            >
              <IconRefresh />
            </MuiIconButton>
            <ToggleColorMode />
          </Stack>
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
          {folders?.map((folder, i) => {
            return (
              <FileTreeView
                key={i}
                data={folder}
                selected={selectedPath}
                onNodeSelect={(_, nodeId) => {
                  setSelectedPath(nodeId);
                  if (nodeId.endsWith(".parquet")) {
                    setStore({
                      page: 1,
                      perPage: 500,
                      tableName: nodeId,
                      orderBy: undefined,
                      sqlWhere: undefined,
                    });
                  }
                }}
              />
            );
          })}
        </Box>
      </Sidebar>
      <Content>
        {!!tableName ? (
          <Dataset />
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
