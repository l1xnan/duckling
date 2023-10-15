import { Box, Divider, IconButton, Stack } from "@mui/material";

import { useEffect } from "react";
import KeyboardArrowLeftIcon from "@mui/icons-material/KeyboardArrowLeft";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import KeyboardDoubleArrowLeftIcon from "@mui/icons-material/KeyboardDoubleArrowLeft";
import KeyboardDoubleArrowRightIcon from "@mui/icons-material/KeyboardDoubleArrowRight";
import Dropdown from "@/components/Dropdown";
import SyncIcon from "@mui/icons-material/Sync";
import DataFrame from "@/components/DataFrame";
import { isDarkTheme } from "@/utils";
import { read_parquet, useStore } from "../stores/store";

export interface DatasetProps {
  tableName: string;
}

function Dataset() {
  const refresh = useStore((state) => state.refresh);
  const data = useStore((state) => state.data);
  const schema = useStore((state) => state.schema);
  const tableName = useStore((state) => state.tableName);
  const page = useStore((state) => state.page);
  const perPage = useStore((state) => state.perPage);
  useEffect(() => {
    refresh().then(() => {});
  }, [tableName, page, perPage]);

  return (
    <Box>
      <PageSizeToolbar />
      <InputToolbar />
      <DataFrame data={data ?? []} schema={schema ?? []} />
    </Box>
  );
}

function PageSizeToolbar() {
  const increase = useStore((state) => state.increase);
  const decrease = useStore((state) => state.decrease);
  const toFirst = useStore((state) => state.toFirst);
  const toLast = useStore((state) => state.toLast);
  const data = useStore((state) => state.data);
  const page = useStore((state) => state.page);
  const perPage = useStore((state) => state.perPage);
  const tableName = useStore((state) => state.tableName);
  const totalCount = useStore((state) => state.totalCount);

  const count = data.length;
  const start = perPage * (page - 1) + 1;
  const end = start + count - 1;
  const content = count >= totalCount ? `${count} rows` : `${start}-${end}`;

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
        <IconButton color="inherit" onClick={toFirst} disabled={page <= 1}>
          <KeyboardDoubleArrowLeftIcon />
        </IconButton>
        <IconButton color="inherit" onClick={decrease} disabled={page <= 1}>
          <KeyboardArrowLeftIcon />
        </IconButton>
        <Dropdown content={content} />
        {count < totalCount ? `of ${totalCount}` : null}
        <IconButton color="inherit" onClick={increase}  disabled={page >= Math.ceil(totalCount / perPage)}>
          <KeyboardArrowRightIcon />
        </IconButton>
        <IconButton color="inherit" onClick={toLast}  disabled={page >= Math.ceil(totalCount / perPage)}>
          <KeyboardDoubleArrowRightIcon />
        </IconButton>
        <Divider orientation="vertical" flexItem />
        <IconButton
          color="inherit"
          onClick={() => {
            read_parquet(tableName as string);
          }}
        >
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
