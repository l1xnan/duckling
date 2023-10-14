import { Box, Divider, Stack } from "@mui/material";
import { invoke } from "@tauri-apps/api/tauri";
// @ts-ignore
import { Table, tableFromIPC } from "apache-arrow";
import { useEffect, useState } from "react";
import KeyboardArrowLeftIcon from "@mui/icons-material/KeyboardArrowLeft";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import KeyboardDoubleArrowLeftIcon from "@mui/icons-material/KeyboardDoubleArrowLeft";
import KeyboardDoubleArrowRightIcon from "@mui/icons-material/KeyboardDoubleArrowRight";
import Dropdown, { PageSizeProps } from "@/components/Dropdown";
import SyncIcon from "@mui/icons-material/Sync";
import DataFrame from "@/components/DataFrame";
import { isDarkTheme } from "@/utils";

interface ValidationResponse {
  row_count: number;
  preview: Array<number>;
}
export interface DatasetProps {
  tableName: string;
}

function Dataset({ tableName }: DatasetProps) {
  const [data, setData] = useState([]);
  const [schema, setSchema] = useState([]);
  const [rowCount, setRowCount] = useState(0);

  useEffect(() => {
    read_parquet(tableName);
  }, [tableName]);

  async function read_parquet(path: string) {
    const { row_count, preview }: ValidationResponse = await invoke(
      "read_parquet",
      { path, limit: 1000, offset: 0 }
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
    setRowCount(row_count);
    console.table(data);
    console.table(schema);
  }

  return (
    <Box>
      <PageSizeToolbar rowCount={rowCount} />
      <InputToolbar />
      <DataFrame data={data} schema={schema} />
    </Box>
  );
}

function PageSizeToolbar({ rowCount }: PageSizeProps) {
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
        <Dropdown rowCount={rowCount} />
        <KeyboardArrowRightIcon />
        <KeyboardDoubleArrowRightIcon />
        <Divider orientation="vertical" flexItem />
        <SyncIcon />
      </Stack>
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
        borderTop: isDarkTheme(theme)
          ? "1px solid #393b40"
          : "1px solid #ebecf0",
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

export default Dataset;
