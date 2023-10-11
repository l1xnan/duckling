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

interface ValidationResponse {
  row_count: number;
  preview: Array<number>;
}
function App() {
  const [opened, { toggle }] = useDisclosure();

  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");
  const [data, setData] = useState([]);
  const [schema, setSchema] = useState([]);

  async function greet() {
    // Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
    setGreetMsg(await invoke("greet", { name }));
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
        <AppShell.Navbar p="md">Navbar</AppShell.Navbar>
        <AppShell.Main>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              greet();

              read_parquet();
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
          <p>{greetMsg}</p>
          <Dataset data={data} columns={schema} />
        </AppShell.Main>
      </AppShell>
    </MantineProvider>
  );
}

export default App;
