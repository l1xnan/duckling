import { Box, Divider, IconButton, Stack } from "@mui/material";
import { invoke } from "@tauri-apps/api/tauri";

import { Table, tableFromIPC } from "@apache-arrow/ts";
import { useEffect, useState } from "react";
import KeyboardArrowLeftIcon from "@mui/icons-material/KeyboardArrowLeft";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import KeyboardDoubleArrowLeftIcon from "@mui/icons-material/KeyboardDoubleArrowLeft";
import KeyboardDoubleArrowRightIcon from "@mui/icons-material/KeyboardDoubleArrowRight";
import Dropdown, { PageSizeProps } from "@/components/Dropdown";
import SyncIcon from "@mui/icons-material/Sync";
import DataFrame, { SchemaType } from "@/components/DataFrame";
import { isDarkTheme } from "@/utils";

interface ValidationResponse {
  row_count: number;
  preview: Array<number>;
}
export interface DatasetProps {
  tableName: string;
}

function Dataset({ tableName }: DatasetProps) {
  const [data, setData] = useState<any[]>([]);
  const [schema, setSchema] = useState<SchemaType[]>([]);
  const [rowCount, setRowCount] = useState(0);

  useEffect(() => {
    read_parquet(tableName);
  }, [tableName]);

  async function read_parquet(path: string) {
    const { row_count, preview }: ValidationResponse = await invoke(
      "read_parquet",
      { path, limit: 500, offset: 0 }
    );
    const table: Table = tableFromIPC(Uint8Array.from(preview));
    const schema: SchemaType[] = table.schema.fields.map((field: any) => {
      return {
        name: field.name,
        dataType: field.type.toString(),
        type: field.type,
        nullable: field.nullable,
        metadata: field.metadata,
      };
    });

    const data = table.toArray().map((item: any, i: number) => ({
      __index__: i + 1,
      ...item.toJSON(),
    }));

    setData(data);
    setSchema(schema);
    setRowCount(row_count);
    console.log(row_count, table);
    console.table([...data.slice(0, 10)]);
    console.table(schema);
  }

  return (
    <Box>
      <PageSizeToolbar
        rowCount={rowCount}
        sync={() => read_parquet(tableName)}
      />
      <InputToolbar />
      <DataFrame data={data} schema={schema} />
    </Box>
  );
}

function PageSizeToolbar({ rowCount, sync }: PageSizeProps) {
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
        <IconButton onClick={sync}>
          <SyncIcon />
        </IconButton>
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
