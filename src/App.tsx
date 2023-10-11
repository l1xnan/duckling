import { invoke } from "@tauri-apps/api/tauri";
import { Table, tableFromIPC } from "apache-arrow";
import { useState } from "react";
import "./App.css";
import reactLogo from "./assets/react.svg";

interface ValidationResponse {
  row_count: number;
  preview: Array<number>;
}
function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");

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
    console.table(table.toArray());

    const array = table.toArray();
    console.table(array.map((item: any) => item.toJSON()));

    const schema = table.schema.fields.map((field: any) => {
      const fs = {
        name: field.name,
        data_type: field.type.toString(),
        nullable: field.nullable,
      };
      return fs;
    });

    console.table(schema);
  }

  return (
    <div className="container">
      <h1>Welcome to Tauri!</h1>

      <div className="row">
        <a href="https://vitejs.dev" target="_blank">
          <img src="/vite.svg" className="logo vite" alt="Vite logo" />
        </a>
        <a href="https://tauri.app" target="_blank">
          <img src="/tauri.svg" className="logo tauri" alt="Tauri logo" />
        </a>
        <a href="https://reactjs.org" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>

      <p>Click on the Tauri, Vite, and React logos to learn more.</p>

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
        <button type="submit">Greet</button>
      </form>

      <p>{greetMsg}</p>
    </div>
  );
}

export default App;
