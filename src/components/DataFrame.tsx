import {
  MRT_ColumnDef,
  MaterialReactTable,
  useMaterialReactTable,
} from "material-react-table";
import { useMemo } from "react";
import * as dayjs from "dayjs";
import { Box } from "@mui/material";
import {
  IconCaretDownFilled,
  IconCaretUpDownFilled,
  IconCaretUpFilled,
} from "@tabler/icons-react";
import { getByteLength, isDarkTheme } from "@/utils";
import { SchemaType, usePageStore } from "@/stores/store";

interface DatasetProps {
  data: any[];
  schema: SchemaType[];
}

function display(dataType: string, name: string) {
  return (row: any) => {
    try {
      const value = row?.[name];
      if (value === null) {
        return "<null>";
      }
      if (dataType === "Bool") {
        return value.toString();
      } else if (dataType.includes("Int")) {
        return value.toString();
      } else if (dataType.includes("Float")) {
        return value.toFixed(4);
      } else if (dataType.includes("Decimal")) {
        return value.toString();
      } else if (dataType.includes("Date32")) {
        return dayjs(value)?.format("YYYY-MM-DD");
      } else {
        return value.toString();
      }
    } catch (error) {
      console.error(row, name, error);
      return `\<${error}\>`;
    }
  };
}

export default function Dataset({ data, schema }: DatasetProps) {
  const { setOrderBy, orderBy } = usePageStore();
  let orderMap = new Map();
  if (orderBy) {
    orderMap.set(orderBy.name, orderBy.desc);
  }

  const columns = useMemo<MRT_ColumnDef<any>[]>(() => {
    const main: MRT_ColumnDef<any>[] =
      schema?.map(({ name, dataType }) => {
        return {
          accessorKey: name,
          header: name,
          accessorFn: display(dataType, name),
          size: Math.min(getByteLength(name) * 10, 200),
          Header: ({ header }) => {
            const isDesc = orderMap.get(name);
            return (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  height: 20,
                  lineHeight: 1,
                  pl: "6px",
                  pr: "6px",
                }}
                onClick={() => {
                  setOrderBy(name);
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
                  {isDesc === undefined ? (
                    <IconCaretUpDownFilled />
                  ) : !isDesc ? (
                    <IconCaretUpFilled />
                  ) : (
                    <IconCaretDownFilled />
                  )}
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
        } as MRT_ColumnDef<any>;
      }) ?? [];
    const first: MRT_ColumnDef<any> = {
      accessorKey: "__index__",
      header: " ",
      maxSize: 50,
      muiTableBodyCellProps: {
        align: "right",
        sx: (theme) => ({
          color: "#aeb3c2",
          boxShadow: 0,
          backgroundColor: isDarkTheme(theme) ? "#2b2d30" : "#ffffff",
          boxRightSizing: "1px",
          borderRightStyle: "solid",
          borderRightColor: isDarkTheme(theme) ? "#1e1f22" : "#ebecf0",
          borderBottom: isDarkTheme(theme)
            ? "1px solid #313438"
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
    enableColumnResizing: true, // resize column width
    enableColumnOrdering: false,
    enableColumnPinning: true,
    // enableGlobalFilterModes: true,

    enablePinning: true,
    enableRowNumbers: false,
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
        tableLayout: "fixed",
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

        p: 0,
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
        backgroundColor: isDarkTheme(theme) ? "#1e1f22" : "#ffffff",
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
      <MaterialReactTable table={table} />
    </Box>
  );
}
