import DBConfig, { useDBConfigStore } from "@/components/DBConfig";
import { MuiIconButton } from "@/components/MuiIconButton";
import ToggleColorMode from "@/components/ToggleColorMode";
import { FileNode, useDBStore } from "@/stores/db";
import { DTableType } from "@/stores/store";
import { showTables } from "@/api";
import { borderTheme } from "@/utils";
import RemoveIcon from "@mui/icons-material/Remove";
import SettingsIcon from "@mui/icons-material/Settings";
import { Box, BoxProps, Stack, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import {
  IconDatabaseCog,
  IconDatabasePlus,
  IconFolderPlus,
  IconRefresh,
} from "@tabler/icons-react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/primitives";
import * as dialog from "@tauri-apps/plugin-dialog";
import { useEffect, useState } from "react";

const ToolbarBox = styled(Box)<BoxProps>(({ theme }) => ({
  height: 32,
  width: "100%",
  paddingLeft: "1rem",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  borderBottom: borderTheme(theme),
}));

export function SideToolbar() {
  const [selectedTable, _] = useState<DTableType | null>(null);
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

  return (
    <>
      <ToolbarBox>
        <Typography fontWeight={800}>Database Explorer</Typography>
        <Stack direction="row">
          <ToggleColorMode />
          <MuiIconButton
            onClick={() => {
              console.log("settings");
            }}
          >
            <SettingsIcon fontSize="inherit" />
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
    </>
  );
}
