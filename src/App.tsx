import { useDisclosure } from "@mantine/hooks";
import { invoke } from "@tauri-apps/api/tauri";
// @ts-ignore
import { Table, tableFromIPC } from "apache-arrow";
import { useEffect, useState } from "react";
import Dataset from "./Dataset";
import { listen } from "@tauri-apps/api/event";
import { ThemeProvider, createTheme } from "@mui/material/styles";

import * as dialog from "@tauri-apps/plugin-dialog";
import FileTreeView, { FileNode } from "./FileTree";
import { Box, Button, CssBaseline } from "@mui/material";

interface ValidationResponse {
  row_count: number;
  preview: Array<number>;
}

const theme = createTheme({
  // @ts-ignore
  shadows: [...Array(25).fill("none")],
  palette: {
    mode: "light",
    // mode: "dark",
  },
  typography: {
    fontFamily: "Consolas",
    fontSize: 14,
  },
});

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
  const [opened, { toggle }] = useDisclosure();

  const [folders, setFolders] = useState<FileNode[]>([]);
  const [data, setData] = useState([]);
  const [schema, setSchema] = useState([]);

  async function openDirectory(name?: string) {
    const fileTree: FileNode = await invoke("greet", { name });
    if (!!fileTree) {
      setFolders([...folders, fileTree]);
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
    <ThemeProvider theme={theme}>
      <CssBaseline enableColorScheme />
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
            borderRight: "1px solid #e2e2e2",
          }}
        >
          {folders ? (
            <ThemeProvider theme={theme}>
              <FileTreeView
                data={folders}
                onNodeSelect={(_, nodeId) => {
                  if (nodeId.endsWith(".parquet")) {
                    read_parquet(nodeId);
                  }
                }}
              />
            </ThemeProvider>
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
          <Dataset data={data} schema={schema} />
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;
