import { useDisclosure } from "@mantine/hooks";
import { invoke } from "@tauri-apps/api/tauri";
import { Table, tableFromIPC } from "apache-arrow";
import { useEffect, useState } from "react";
import Dataset from "./Dataset";
import { listen } from "@tauri-apps/api/event";
import { IconFolder, IconFile } from "@tabler/icons-react";
import { ThemeProvider, createTheme } from "@mui/material/styles";

import * as dialog from "@tauri-apps/plugin-dialog";
import FileTreeView, { FileNode } from "./FileTree";
import { Box, Button } from "@mui/material";

interface ValidationResponse {
  row_count: number;
  preview: Array<number>;
}

const theme = createTheme({
  // @ts-ignore
  shadows: [...Array(25).fill("none")],
  palette: {
    mode: "light",
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

  const [fileTree, setFileTree] = useState<FileNode | null>(null);
  const [data, setData] = useState([]);
  const [schema, setSchema] = useState([]);

  async function openDirectory(name?: string) {
    // Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
    const fileTree: FileNode = await invoke("greet", { name });
    console.log(fileTree);
    if (!!fileTree) {
      setFileTree(fileTree);
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
        data_type: field.type.toString(),
        nullable: field.nullable,
      };
    });

    const data = array.map((item: any) => item.toJSON());

    setData(data);
    setSchema(
      schema.map(({ name }: any) => ({
        accessorKey: name,
        header: name,
      }))
    );
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
      <Box
        sx={{
          display: "flex",
          maxHeight: "100vh",
          height: "100%",
          pr: 0,
          p: 0,
          m: 0,
          // overflow: "hidden",
        }}
      >
        <Box
          sx={{
            flexShrink: 0,
            width: 300,
            maxHeight: "100vh",
            height: "100%",
            overflow: "auto",
            pr: 1,
            pb: 5,
          }}
        >
          {fileTree ? (
            <ThemeProvider theme={theme}>
              <FileTreeView
                data={fileTree}
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
          <Dataset data={data} columns={schema} />
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;
