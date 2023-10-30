import {
  Box,
  BoxProps,
  Icon,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/primitives";
import * as dialog from "@tauri-apps/plugin-dialog";
import Dataset from "@/components/Dataset";
import FileTreeView from "@/components/FileTree";
import { Content, Layout, Sidebar } from "@/components/Layout";
import ToggleColorMode from "@/components/ToggleColorMode";
import RemoveIcon from "@mui/icons-material/Remove";
import SettingsIcon from "@mui/icons-material/Settings";
import { isDarkTheme } from "@/utils";
import { useEffect, useState } from "react";
import { showTables, useStore, DTableType } from "@/stores/store";
import {
  IconDatabaseCog,
  IconDatabasePlus,
  IconFolderPlus,
  IconRefresh,
} from "@tabler/icons-react";
import { MuiIconButton, TablerSvgIcon } from "@/components/MuiIconButton";
import DBConfig, { useDBConfigStore } from "./components/DBConfig";
import { FileNode, useDBStore } from "@/stores/db";
import { useTabsStore } from "./stores/tabs";
import { FileTab, FileTabs } from "./components/FileTabs";

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
  const tabs = useTabsStore((state) => state.tabs);

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
  const setDB = useDBConfigStore((state) => state.setDB);

  const handleOpen = () => {
    setDB(selectedTable!);
    onOpen();
  };

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

  const [value, setValue] = useState(0);

  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };
  return (
    <Layout>
      <Sidebar>
        <ToolbarBox>
          <Typography fontWeight={800}>Database Explorer</Typography>
          <Stack direction="row">
            <ToggleColorMode />
            <MuiIconButton
              onClick={() => {
                console.log("settings");
              }}
            >
              <SettingsIcon />
            </MuiIconButton>
          </Stack>
        </ToolbarBox>
        <ToolbarBox>
          <Stack
            direction="row"
            sx={{
              marginLeft: -1,
            }}
          >
            <MuiIconButton onClick={handleAppendFolder}>
              <IconFolderPlus />
            </MuiIconButton>
            <MuiIconButton onClick={handleAppendDB}>
              <IconDatabasePlus />
            </MuiIconButton>
            {/* db config */}
            <DBConfig />
            <MuiIconButton
              disabled={!(isRoot && selectedTable?.root?.endsWith(".duckdb"))}
              onClick={handleOpen}
            >
              <IconDatabaseCog />
            </MuiIconButton>
            {/* remove db */}
            <MuiIconButton disabled={!isRoot} onClick={handleRemoveDB}>
              <RemoveIcon />
            </MuiIconButton>
            {/* refresh tree */}
            <MuiIconButton disabled={!isRoot} onClick={handleRefresh}>
              <IconRefresh />
            </MuiIconButton>
          </Stack>
        </ToolbarBox>
        <TreeViewWrapper>
          {dbList.map((db, i) => (
            <FileTreeView
              key={i}
              rootKey={i}
              db={db}
              selected={
                selectedTable?.rootKey == i ? selectedTable.tableName : null
              }
              onSelectTable={setSelectedTable}
            />
          ))}
        </TreeViewWrapper>
      </Sidebar>
      <Content>
        {!!table?.tableName ? (
          <>
            <FileTabs value={value} onChange={handleChange}>
              {tabs.map((tab, i) => {
                return <FileTab key={i} label={tab?.tableName} />;
              })}
            </FileTabs>
            <Dataset />
          </>
        ) : (
          <DatasetEmpty />
        )}
      </Content>
    </Layout>
  );
}

const TreeViewWrapper = styled(Box)<BoxProps>(({ theme }) => ({
  width: "100%",
  maxHeight: "calc(100vh - 64px)",
  height: "calc(100vh - 64px)",
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
