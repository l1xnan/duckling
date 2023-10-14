import { Box, Button, CssBaseline, Divider, Stack } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/tauri";
import * as dialog from "@tauri-apps/plugin-dialog";
// @ts-ignore
import { Table, tableFromIPC } from "apache-arrow";
import { useEffect, useState } from "react";
import { useLocalStorageState } from "ahooks";
import KeyboardArrowLeftIcon from "@mui/icons-material/KeyboardArrowLeft";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import KeyboardDoubleArrowLeftIcon from "@mui/icons-material/KeyboardDoubleArrowLeft";
import KeyboardDoubleArrowRightIcon from "@mui/icons-material/KeyboardDoubleArrowRight";
import Dropdown from "./components/Dropdown";
import SyncIcon from "@mui/icons-material/Sync";
import ToggleColorMode from "./components/ToggleColorMode";
import Dataset from "./components/Dataset";
import FileTreeView, { FileNode } from "./FileTree";
import { isDarkTheme } from "./utils";

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

function Database() {
  const theme = useTheme();
  const [folders, setFolders] = useLocalStorageState<FileNode[]>("folders", {
    defaultValue: [],
  });
  const [data, setData] = useState([]);
  const [schema, setSchema] = useState([]);

  async function openDirectory(name?: string) {
    const fileTree: FileNode = await invoke("greet", { name });
    if (!!fileTree) {
      setFolders([...(folders ?? []), fileTree]);
    }
  }

  async function read_parquet(path: string) {
    const { row_count, preview }: ValidationResponse = await invoke(
      "read_parquet",
      { path }
    );
    const table: Table = tableFromIPC(Uint8Array.from(preview));
    console.log(row_count, table);

    const array = table.toArray();

    const schema = table.schema.fields.map((field: any) => {
      return {
        name: field.name,
        dataType: field.type.toString(),
        type: field.type,
        nullable: field.nullable,
        metadata: field.metadata,
      };
    });

    const data = array.map((item: any) => item.toJSON());

    setData(data);
    setSchema(schema);
    console.table(data);
    console.table(schema);
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
    <Box>
      <Box
        sx={{
          display: "flex",
          maxHeight: "100vh",
          height: "100%",
          pr: 0,
          p: 0,
          m: 0,
        }}
      >
        <Box
          sx={{
            flexShrink: 0,
            width: 300,
            minHeight: "100vh",
            height: "100vh",
            overflow: "auto",
            pr: 1,
            pb: 5,
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
                  read_parquet(nodeId);
                }
              }}
            />
          ) : null}
        </Box>
        <Box
          sx={{
            flexGrow: 1,
            height: "100vh",
            maxHeight: "100vh",
            width: "calc(100vw - 300px)",
            overflow: "hidden",
          }}
        >
          <PageSizeToolbar />
          <InputToolbar />
          <Dataset data={data} schema={schema} />
        </Box>
      </Box>
    </Box>
  );
}

function PageSizeToolbar() {
  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      sx={(theme) => ({
        backgroundColor: isDarkTheme(theme) ? "#2b2d30" : "#f7f8fa",
        height: 32,
        alignItems: "center",
        border: isDarkTheme(theme) ? "1px solid #393b40" : "1px solid  #f7f8fa",
        "& input, & input:focus-visible": {
          border: "none",
          height: "100%",
          padding: 0,
          outlineWidth: 0,
        },
      })}
    >
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={(theme) => ({
          backgroundColor: isDarkTheme(theme) ? "#2b2d30" : "#f7f8fa",
          height: 32,
          "& MuiSvgIcon-root": {
            fontSize: 16,
          },
        })}
      >
        <KeyboardDoubleArrowLeftIcon />
        <KeyboardArrowLeftIcon />
        <Dropdown />
        <KeyboardArrowRightIcon />
        <KeyboardDoubleArrowRightIcon />
        <Divider orientation="vertical" flexItem />
        <SyncIcon />
      </Stack>
      <ToggleColorMode />
    </Stack>
  );
}

export function InputToolbar() {
  return (
    <Box
      sx={(theme) => ({
        backgroundColor: isDarkTheme(theme) ? "#2b2d30" : "#f7f8fa",
        height: 32,
        display: "flex",
        alignItems: "center",
        border: isDarkTheme(theme) ? "1px solid #393b40" : "1px solid  #f7f8fa",
        "& input, & input:focus-visible": {
          border: "none",
          height: "100%",
          padding: 0,
          outlineWidth: 0,
        },
      })}
    >
      <Box
        sx={{
          flexGrow: 0,
          ml: 1,
          mr: 1,
        }}
      >
        WHERE
      </Box>
      <input />
      <Divider orientation="vertical" flexItem />
      <Box
        sx={{
          flexGrow: 0,
          mr: 1,
          ml: 1,
        }}
      >
        ORDER BY
      </Box>
      <input />
    </Box>
  );
}

export default Database;
