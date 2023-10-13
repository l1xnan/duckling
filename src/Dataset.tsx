import {
  MRT_ColumnDef,
  MaterialReactTable,
  useMaterialReactTable,
} from "material-react-table";
import { useContext, useMemo } from "react";
import * as dayjs from "dayjs";
import { Box, Divider, Stack } from "@mui/material";
import { IconCaretUpDownFilled } from "@tabler/icons-react";
import KeyboardArrowLeftIcon from "@mui/icons-material/KeyboardArrowLeft";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import KeyboardDoubleArrowLeftIcon from "@mui/icons-material/KeyboardDoubleArrowLeft";
import KeyboardDoubleArrowRightIcon from "@mui/icons-material/KeyboardDoubleArrowRight";
import Dropdown from "./components/Dropdown";
import SyncIcon from "@mui/icons-material/Sync";
import { ColorModeContext } from "./theme";
import { isDarkTheme } from "./utils";
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
  const colorMode = useContext(ColorModeContext);

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
    const first: MRT_ColumnDef<any> = {
      accessorKey: "__index__",
      header: " ",
      maxSize: 50,
      accessorFn: (row: any) => {
        console.log(row);
        return 111;
      },
      muiTableBodyCellProps: {
        align: "right",
        sx: (theme) => ({
          color: "#aeb3c2",
          boxShadow: 0,
          backgroundColor: theme.palette.mode === "dark" ? "#2b2d30" : "white",
          borderRight: isDarkTheme(theme)
            ? "1px solid #1e1f22"
            : "1px solid #ebecf0",

          p: `6px`,
          fontSize: 10,
          lineHeight: 1,
        }),
      },
      muiTableHeadCellProps: {
        sx: (theme) => ({
          color: "#aeb3c2",
          boxShadow: 0,
          backgroundColor: isDarkTheme(theme) ? "#2e2f32" : "#efefef",
          borderRight: isDarkTheme(theme)
            ? "1px solid #1e1f22"
            : "1px solid #e2e2e2",
          fontSize: 10,
          lineHeight: 1,
        }),
      },
    };
    return [first, ...main];
  }, [schema]);

  const table = useMaterialReactTable({
    columns,
    data,
    initialState: {
      density: "compact",
      columnPinning: {
        left: ["__index__"],
      },
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
    enableColumnPinning: true,
    // enableGlobalFilterModes: true,
    enablePinning: true,
    // enableRowNumbers: true,
    muiTablePaperProps: {
      elevation: 0, //change the mui box shadow
      //customize paper styles
      sx: {
        borderRadius: "0",
        border: "none",
      },
    },
    muiTableContainerProps: {
      sx: (theme) => ({
        maxHeight: "calc(100vh - 60px)",
        fontFamily: "Consolas",
        borderTop: isDarkTheme(theme)
          ? "1px solid #393b40"
          : "1px solid #e2e2e2",
      }),
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
      sx: (theme) => ({
        boxShadow: "1px 0 2px rgba(0, 0, 0, 0.1)",
        backgroundColor: isDarkTheme(theme) ? "#2b2d30" : "#f7f8fa",
      }),
    },

    muiTableHeadCellProps: (_) => ({
      //no useTheme hook needed, just use the `sx` prop with the theme callback
      sx: (theme) => ({
        // justifyContent: "space-between",
        // width: "100%",
        alignItems: "center",
        lineHeight: 1,
        fontFamily: "Consolas",
        borderRight: isDarkTheme(theme)
          ? "1px solid #1e1f22"
          : "1px solid #e2e2e2",

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
      sx: (theme) => ({
        p: `6px`,
        fontSize: 10,
        lineHeight: 1,
        backgroundColor: "#1e1f22",
        borderCollapse: "collapse",
        borderBottom: isDarkTheme(theme)
          ? "1px solid #313438"
          : "1px solid #ebecf0",
        borderRight: isDarkTheme(theme)
          ? "1px solid #313438"
          : "1px solid #ebecf0",
      }),
    },
  });
  return (
    <Box sx={{}}>
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
        <Dropdown />
        <KeyboardArrowRightIcon />
        <KeyboardDoubleArrowRightIcon />
        <Divider orientation="vertical" flexItem />
        <SyncIcon />
      </Stack>
      <Box
        sx={(theme) => ({
          backgroundColor: isDarkTheme(theme) ? "#2b2d30" : "#f7f8fa",
          height: 32,
          display: "flex",
          alignItems: "center",
          border: isDarkTheme(theme)
            ? "1px solid #393b40"
            : "1px solid  #f7f8fa",
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
      <MaterialReactTable table={table} />
    </Box>
  );
}
