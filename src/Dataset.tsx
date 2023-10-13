import {
  MRT_ColumnDef,
  MaterialReactTable,
  useMaterialReactTable,
} from "material-react-table";
import { useMemo } from "react";
import * as dayjs from "dayjs";
import {
  Box,
  ClickAwayListener,
  Divider,
  Grow,
  MenuItem,
  MenuList,
  Paper,
  Popper,
} from "@mui/material";
import { IconCaretUpDown, IconCaretUpDownFilled } from "@tabler/icons-react";
import KeyboardArrowLeftIcon from "@mui/icons-material/KeyboardArrowLeft";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import KeyboardDoubleArrowLeftIcon from "@mui/icons-material/KeyboardDoubleArrowLeft";
import KeyboardDoubleArrowRightIcon from "@mui/icons-material/KeyboardDoubleArrowRight";
import Dropdown from "./components/Dropdown";
import SyncIcon from "@mui/icons-material/Sync";
type SchemaType = {
  name: string;
  dataType: string;
  nullable: string;
};

interface DatasetProps {
  data: any[];
  schema: SchemaType[];
}

export default function Dataset({ data, schema }: DatasetProps) {
  const columns = useMemo<MRT_ColumnDef<any>[]>(() => {
    const main: MRT_ColumnDef<any>[] = schema?.map(({ name, dataType }) => {
      let accessorFn = undefined;
      if (dataType === "Int64") {
        accessorFn = (row: any) => row?.[name].toString();
      } else if (dataType.includes("Float")) {
        accessorFn = (row: any) => row?.[name].toFixed(4);
      } else if (dataType.includes("Date32")) {
        accessorFn = (row: any) => dayjs(row?.[name]).format("YYYY-MM-DD");
      }
      return {
        accessorKey: name,
        header: name,
        accessorFn,
        // maxSize: 100,
        Header: ({ column }) => {
          return (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                height: 20,
                lineHeight: 1,
              }}
            >
              <Box sx={{}}>{name}</Box>
              <Box
                sx={{
                  fontSize: 1,
                  "& *": {
                    maxHeight: "12px",
                    height: "12px",
                    maxWidth: "12px",
                    fontWeight: 400,
                  },
                }}
              >
                <IconCaretUpDownFilled />
              </Box>
            </Box>
          );
        },
        muiTableBodyCellProps: {
          align:
            dataType.includes("Int") || dataType.includes("Float")
              ? "right"
              : "left",
        },
        muiTableHeadCellProps: {
          align:
            dataType.includes("Int") || dataType.includes("Float")
              ? "right"
              : "left",
        },
      };
    });
    const first = {
      accessorKey: "__index__",
      header: " ",
      accessorFn: (row: any) => {
        console.log(row);
        return row.account_id;
      },
      muiTableBodyCellProps: {
        color: "#e3e3e3",
      },
    };
    return [first, ...main];
  }, [schema]);

  const table = useMaterialReactTable({
    columns,
    data,
    initialState: {
      density: "compact",
    },
    // virtual
    enableRowVirtualization: true,
    enableStickyHeader: true,
    enableColumnVirtualization: true,

    // header action
    enableColumnActions: false,
    enableColumnFilters: false,
    enableSorting: false,
    enableBottomToolbar: false,
    enableTopToolbar: false,
    enableRowSelection: false,
    enableRowPinning: false,
    rowPinningDisplayMode: "select-sticky",
    enablePagination: false,
    defaultDisplayColumn: {
      enableResizing: true,
    },
    enableDensityToggle: false,
    enableColumnResizing: false, // resize column width
    enableColumnOrdering: false,
    enableColumnPinning: false,
    // enableGlobalFilterModes: true,
    enablePinning: false,
    enableRowNumbers: true,
    muiTablePaperProps: {
      elevation: 0, //change the mui box shadow
      //customize paper styles
      sx: {
        borderRadius: "0",
        border: "none",
      },
    },
    muiTableContainerProps: {
      sx: {
        maxHeight: "calc(100vh - 60px)",
        fontFamily: "Consolas",
        borderTop: "1px solid #e2e2e2",
      },
    },
    muiTopToolbarProps: {},
    muiTableProps: {
      sx: {
        borderSpacing: 0,
        boxSizing: "border-box",
      },
    },
    muiTableHeadProps: {},
    muiTableHeadRowProps: {
      sx: {
        boxShadow: "1px 0 2px rgba(0, 0, 0, 0.1)",
        backgroundColor: "#f7f8fa",
      },
    },

    muiTableHeadCellProps: (_) => ({
      //no useTheme hook needed, just use the `sx` prop with the theme callback
      sx: (_theme) => ({
        // justifyContent: "space-between",
        // width: "100%",
        alignItems: "center",
        lineHeight: 1,
        fontFamily: "Consolas",
        borderRight: "1px solid #e2e2e2",
        p: `6px`,
        "& .Mui-TableHeadCell-Content-Wrapper": {
          width: "100%",
        },
        "& .Mui-TableHeadCell-Content-Labels": {
          width: "100%",
        },
      }),
    }),
    muiTableBodyProps: {
      sx: {
        "&:nth-of-type(odd)": {
          backgroundColor: "white",
        },
        "&:nth-of-type(even)": {
          backgroundColor: "grey ",
        },
      },
    },
    muiTableBodyRowProps: {
      sx: {
        "&:*": {
          backgroundColor: "grey",
        },
      },
    },
    muiTableBodyCellProps: {
      sx: {
        p: `6px`,
        fontSize: 10,
        borderBottom: "1px solid #e2e2e2",
        borderRight: "1px solid #e2e2e2",
        lineHeight: 1,
        borderCollapse: "collapse",
      },
    },
  });
  return (
    <Box>
      <Box
        sx={{
          backgroundColor: "#f7f8fa",
          height: 32,
          display: "flex",
          alignItems: "center",
        }}
      >
        <KeyboardDoubleArrowLeftIcon />
        <KeyboardArrowLeftIcon />
        <Dropdown />
        <KeyboardArrowRightIcon />
        <KeyboardDoubleArrowRightIcon />
        <Divider orientation="vertical" flexItem />
        <SyncIcon />
      </Box>
      <Box
        sx={{
          backgroundColor: "#f7f8fa",
          height: 32,
          display: "flex",
          alignItems: "center",
          border: "1px solid #ebecf0",
          "& input, & input:focus-visible": {
            border: "none",
            height: "100%",
            padding: 0,
            outlineWidth: 0,
          },
        }}
      >
        <Box
          sx={{
            flexGrow: 0,
          }}
        >
          WHERE
        </Box>
        <input />
        <Divider orientation="vertical" flexItem />
        <Box
          sx={{
            flexGrow: 0,
          }}
        >
          ORDER BY
        </Box>
        <input />
      </Box>
      <MaterialReactTable table={table} />
    </Box>
  );
}
