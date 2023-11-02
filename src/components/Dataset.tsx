import {
  Box,
  CircularProgress,
  Divider,
  IconButton,
  InputBase,
  InputLabel,
  Snackbar,
  Stack,
} from "@mui/material";
import KeyboardArrowLeftIcon from "@mui/icons-material/KeyboardArrowLeft";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import KeyboardDoubleArrowLeftIcon from "@mui/icons-material/KeyboardDoubleArrowLeft";
import KeyboardDoubleArrowRightIcon from "@mui/icons-material/KeyboardDoubleArrowRight";
import Dropdown from "@/components/Dropdown";
import SyncIcon from "@mui/icons-material/Sync";
import { borderTheme, isDarkTheme } from "@/utils";
import {
  DTableType,
  PageContext,
  createPageStore,
  usePageStore,
} from "@/stores/store";
import { convertOrderBy } from "@/utils";
import { AgTable } from "./AgTable";
import { IconDecimal } from "@tabler/icons-react";
import { TablerSvgIcon } from "./MuiIconButton";
import {
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import React from "react";
import { FileTabPanel } from "./FileTabs";

export interface DatasetProps {
  tableName: string;
}

export const PageProvider = ({
  table,
  children,
}: {
  table: DTableType;
  children: ReactNode;
}) => {
  const storeRef = useRef(createPageStore(table));
  return (
    <PageContext.Provider value={storeRef.current}>
      {children}
    </PageContext.Provider>
  );
};

export const usePageStoreApi = () => {
  const store = useContext(PageContext);
  if (store === null) {
    throw new Error("no provider");
  }
  return store;
};

export const MemoPanel = React.memo(
  ({ table, idx }: { table: DTableType; idx: number }) => {
    return (
      <PageProvider table={table}>
        <FileTabPanel value={`${idx}`}>
          <MemoDataset />
        </FileTabPanel>
      </PageProvider>
    );
  }
);

export const MemoDataset = React.memo(function Dataset() {
  const {
    refresh,
    data,
    schema,
    table,
    page,
    perPage,
    orderBy,
    sqlWhere,
    code,
    message,
    beautify,
  } = usePageStore();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const callback = useCallback(() => {
    (async () => {
      try {
        setLoading(true);
        await refresh();
      } catch (error) {}
      setLoading(false);
    })();
  }, [table, page, perPage, orderBy, sqlWhere]);
  useEffect(() => {
    callback();
  }, [callback]);

  useEffect(() => {
    if (code != 0) {
      setOpen(true);
    }
  }, [table, code, message]);

  const handleClose = (
    _event: React.SyntheticEvent | Event,
    reason?: string
  ) => {
    if (reason === "clickaway") {
      return;
    }

    setOpen(false);
  };

  return (
    <Stack>
      <PageSizeToolbar />
      <InputToolbar />
      <Box>
        {loading ? (
          <Box
            sx={{
              display: "flex",
              height: "calc(100vh - 64px)",
              width: "100%",
              marginTop: "30%",
              justifyContent: "center",
            }}
          >
            <CircularProgress />
          </Box>
        ) : (
          <AgTable
            data={data ?? []}
            schema={schema ?? []}
            beautify={beautify}
          />
        )}
      </Box>

      {message?.length ?? 0 > 0 ? (
        <Snackbar
          open={open}
          autoHideDuration={6000}
          onClose={handleClose}
          message={message ?? ""}
        />
      ) : null}
    </Stack>
  );
});

function PageSizeToolbar() {
  const {
    refresh,
    data,
    page,
    totalCount,
    setBeautify,
    increase,
    decrease,
    toFirst,
    toLast,
    perPage,
  } = usePageStore();

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
        borderBottom: borderTheme(theme),
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
        <IconButton
          color="inherit"
          onClick={increase}
          disabled={page >= Math.ceil(totalCount / perPage)}
        >
          <KeyboardArrowRightIcon />
        </IconButton>
        <IconButton
          color="inherit"
          onClick={toLast}
          disabled={page >= Math.ceil(totalCount / perPage)}
        >
          <KeyboardDoubleArrowRightIcon />
        </IconButton>
        <IconButton color="inherit" onClick={setBeautify}>
          <TablerSvgIcon icon={<IconDecimal />} />
        </IconButton>
        <Divider orientation="vertical" flexItem />
        <IconButton
          color="inherit"
          onClick={async () => {
            await refresh();
          }}
        >
          <SyncIcon fontSize="small" />
        </IconButton>
      </Stack>
    </Stack>
  );
}

export function InputToolbar() {
  const { orderBy, setSQLWhere } = usePageStore();

  const [stmtWhere, setStmtWhere] = useState("");
  const [stmtOrder, setStmtOrder] = useState(
    orderBy ? convertOrderBy(orderBy) : ""
  );

  useEffect(() => {
    setStmtOrder(orderBy ? convertOrderBy(orderBy) : "");
  }, [orderBy]);
  return (
    <Box
      sx={(theme) => ({
        backgroundColor: isDarkTheme(theme) ? "#1e1f22" : "#ffffff",
        height: 32,
        display: "flex",
        alignItems: "center",
        borderBottom: borderTheme(theme),
        "& input, & input:focus-visible, & .MuiInputBase-root": {
          border: "none",
          height: "100%",
          padding: 0,
          outlineWidth: 0,
          backgroundColor: isDarkTheme(theme) ? "#1e1f22" : "#ffffff",
        },
      })}
    >
      <Stack direction="row">
        <Box sx={{ flexGrow: 0, mr: 1, ml: 1 }}>
          <InputLabel sx={{ width: "auto" }}>WHERE</InputLabel>
        </Box>
        <InputBase
          color="primary"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setSQLWhere(stmtWhere);
            }
          }}
          onChange={(e) => {
            setStmtWhere(e.target.value);
          }}
        />
      </Stack>
      <Divider orientation="vertical" flexItem />
      <Stack direction="row">
        <Box sx={{ flexGrow: 0, mr: 1, ml: 1 }}>
          <InputLabel>ORDER BY</InputLabel>
        </Box>
        <InputBase
          value={stmtOrder}
          fullWidth
          color="primary"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setSQLWhere(stmtWhere);
            }
          }}
          onChange={(e) => {
            setStmtOrder(e.target.value);
          }}
        />
      </Stack>
    </Box>
  );
}

export default MemoDataset;
