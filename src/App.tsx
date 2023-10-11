import {
  AppShell,
  Burger,
  Group,
  MantineProvider,
  Button,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { invoke } from "@tauri-apps/api/tauri";
import { Table, tableFromIPC } from "apache-arrow";
import { useState } from "react";
import Dataset from "./Dataset";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { TreeView } from "@mui/x-tree-view/TreeView";
import { TreeItem } from "@mui/x-tree-view/TreeItem";
interface ValidationResponse {
  row_count: number;
  preview: Array<number>;
}

const genDirTree = (tree) => {
  if (!tree) {
    return null;
  }
  if (tree.children.length == 0) {
    <TreeItem key={tree.name} nodeId={tree.name} label={tree.name} />;
  }
  return (
    <TreeItem key={tree.name} nodeId={tree.name} label={tree.name}>
      {tree.children?.map((item) => {
        return genDirTree(item);
      })}
    </TreeItem>
  );
};

function App() {
  const [opened, { toggle }] = useDisclosure();

  const [pathTree, setPathTree] = useState();
  const [name, setName] = useState("");
  const [data, setData] = useState([]);
  const [schema, setSchema] = useState([]);

  async function greet() {
    // Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
    const pathTree = await invoke("greet", { name });
    console.log(pathTree);
    setPathTree(pathTree);
  }

  async function read_parquet() {
    const { row_count, preview }: ValidationResponse = await invoke(
      "read_parquet",
      { path: name }
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

  return (
    <MantineProvider>
      <AppShell
        header={{ height: 60 }}
        navbar={{
          width: 300,
          breakpoint: "sm",
          collapsed: { mobile: !opened },
        }}
        padding="md"
      >
        <AppShell.Header>
          <Group h="100%" px="md">
            <Burger
              opened={opened}
              onClick={toggle}
              hiddenFrom="sm"
              size="sm"
            />
          </Group>
        </AppShell.Header>
        <AppShell.Navbar p="md">
          <TreeView
            aria-label="file system navigator"
            defaultCollapseIcon={<ExpandMoreIcon />}
            defaultExpandIcon={<ChevronRightIcon />}
          >
            {genDirTree(pathTree)}
          </TreeView>
        </AppShell.Navbar>
        <AppShell.Main>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              greet();

              // read_parquet();
            }}
          >
            <input
              id="greet-input"
              onChange={(e) => setName(e.currentTarget.value)}
              placeholder="Enter a name..."
            />
            <Button type="submit" color="violet">
              Read
            </Button>
          </form>
          <Dataset data={data} columns={schema} />
        </AppShell.Main>
      </AppShell>
    </MantineProvider>
  );
}

export default App;
