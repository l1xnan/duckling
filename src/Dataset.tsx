import {
  MRT_ColumnDef,
  MaterialReactTable,
  useMaterialReactTable,
} from "material-react-table";
import { useMemo } from "react";
import * as dayjs from "dayjs";

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
  const columns = useMemo<MRT_ColumnDef<any>[]>(
    () =>
      schema?.map(({ name, dataType }) => {
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
          muiTableBodyCellProps: {
            align:
              dataType.includes("Int") || dataType.includes("Float")
                ? "right"
                : "left",
          },
        };
      }),
    [schema]
  );

  const table = useMaterialReactTable({
    columns,
    data,
    initialState: {
      density: "compact",
    },
    enableRowVirtualization: true,
    enableRowSelection: false,
    enableRowPinning: true,
    rowPinningDisplayMode: "select-sticky",

    enableStickyHeader: true,
    enablePagination: false,
    defaultDisplayColumn: {
      enableResizing: true,
    },
    enableDensityToggle: false,
    enableColumnResizing: true,
    enableColumnOrdering: true,
    enableColumnPinning: true,
    enableColumnVirtualization: true,
    enableGlobalFilterModes: true,
    enablePinning: true,
    enableRowNumbers: true,
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
    muiTableHeadRowProps: {
      sx: {
        boxShadow: "1px 0 2px rgba(0, 0, 0, 0.1)",
      },
    },
    muiTableHeadCellProps: {
      sx: {
        lineHeight: 1,
        fontFamily: "Consolas",
        borderRight: "1px solid #e2e2e2",
        p: `6px`,
      },
    },
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
  return <MaterialReactTable table={table} />;
}
