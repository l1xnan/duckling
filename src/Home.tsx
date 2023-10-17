import { Box, BoxProps, Stack, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/tauri";
import * as dialog from "@tauri-apps/plugin-dialog";
import Dataset from "@/components/Dataset";
import FileTreeView from "@/components/FileTree";
import { Content, Layout, Sidebar } from "@/components/Layout";
import ToggleColorMode from "@/components/ToggleColorMode";
import RemoveIcon from "@mui/icons-material/Remove";
import { isDarkTheme } from "@/utils";
import { useEffect, useState } from "react";
import { showTables, useStore, DTableType } from "@/stores/store";
import {
  IconDatabaseCog,
  IconDatabasePlus,
  IconFolderPlus,
  IconRefresh,
} from "@tabler/icons-react";
import { MuiIconButton } from "@/components/MuiIconButton";
import DBConfig, { useDBConfigStore } from "./components/DBConfig";
import { FileNode, useDBStore } from "@/stores/db";

export const DatasetEmpty = styled((props) => <Box {...props} />)<BoxProps>(
  ({}) => ({
    display: "flex",
    marginTop: "20%",
    height: "100%",
    justifyContent: "center",
  })
);

function Home() {
  const [selectedTable, setSelectedTable] = useState<DTableType | null>(null);
  const dbList = useDBStore((state) => state.dbList);
  const appendDB = useDBStore((state) => state.append);
  const removeDB = useDBStore((state) => state.remove);
  const updateDB = useDBStore((state) => state.update);

  async function openDirectory(name?: string) {
    const fileTree: FileNode = await invoke("get_folder_tree", { name });
    if (!!fileTree) {
      appendDB({
        data: fileTree,
      });
    }
  }
  async function openUrl() {
    const path: string = await invoke("opened_urls");
    console.log(path);
  }

  useEffect(() => {
    openUrl();
    const unlisten = listen("open-directory", (e) => {
      console.log(e.payload);

      openDirectory(e.payload as string);
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, []);
  const table = useStore((state) => state.table);

  const onOpen = useDBConfigStore((state) => state.onOpen);

  async function handleRemoveDB() {
    removeDB(selectedTable?.root!);
  }
  async function handleAppendDB() {
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
  }

  async function handleAppendFolder() {
    const res = await dialog.open({
      directory: true,
    });
    if (res) {
      openDirectory(res);
    }
  }

  async function handleRefresh() {
    console.log(selectedTable);
    if (selectedTable && selectedTable.tableName.endsWith(".duckdb")) {
      const res = await showTables(selectedTable.root);
      console.log(res);
      updateDB({
        path: selectedTable.root,
        children: res.data.map(({ table_name, table_type }) => ({
          name: table_name,
          path: table_name,
          type: table_type == "VIEW" ? "view" : "table",
          is_dir: false,
        })),
      });
    }
  }

  const isRoot = dbList
    .map((item) => item.data.path)
    .includes(selectedTable?.tableName!);
  return (
    <Layout>
      <Sidebar>
        <ToolbarBox>
          <Typography fontWeight={800}>Database Explorer</Typography>
          <Stack direction="row">
            <MuiIconButton onClick={handleAppendFolder}>
              <IconFolderPlus />
            </MuiIconButton>
            <MuiIconButton onClick={handleAppendDB}>
              <IconDatabasePlus />
            </MuiIconButton>
            {/* <DBConfig db={selectedTable} /> */}
            <MuiIconButton
              disabled={!selectedTable?.root?.endsWith(".duckdb")}
              onClick={onOpen}
            >
              <IconDatabaseCog />
            </MuiIconButton>
            <MuiIconButton disabled={!isRoot} onClick={handleRemoveDB}>
              <RemoveIcon />
            </MuiIconButton>
            {/* refresh tree */}
            <MuiIconButton disabled={!isRoot} onClick={handleRefresh}>
              <IconRefresh />
            </MuiIconButton>
            <ToggleColorMode />
          </Stack>
        </ToolbarBox>
        <TreeViewWrapper>
          {dbList.map((db, i) => (
            <FileTreeView
              key={i}
              rootKey={i}
              data={db.data}
              selected={
                selectedTable?.rootKey == i ? selectedTable.tableName : null
              }
              onSelectTable={setSelectedTable}
            />
          ))}
        </TreeViewWrapper>
      </Sidebar>
      <Content>{!!table?.tableName ? <Dataset /> : <DatasetEmpty />}</Content>
    </Layout>
  );
}

const TreeViewWrapper = styled(Box)<BoxProps>(({ theme }) => ({
  width: "100%",
  maxHeight: "calc(100vh - 32px)",
  height: "calc(100vh - 32px)",
  overflow: "auto",
  pr: 1,
  pb: 2,
  borderRight: isDarkTheme(theme) ? "1px solid #1e1f22" : "1px solid #e2e2e2",
}));

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
