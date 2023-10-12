import {
  MaterialReactTable,
  useMaterialReactTable,
} from "material-react-table";

export default function Dataset({ data, columns }: any) {
  const table = useMaterialReactTable({
    columns,
    data,
    enableRowSelection: true,
    initialState: {
      density: "compact",
    },
    defaultDisplayColumn: {
      enableResizing: true,
    },
    enableBottomToolbar: false,
    enableColumnResizing: true,
    enableColumnVirtualization: true,
    enableGlobalFilterModes: true,
    enablePagination: false,
    enablePinning: true,
    enableRowNumbers: true,
    enableRowVirtualization: true,
    muiTableContainerProps: {
      sx: {
        // maxHeight: "600px",
        maxHeight: "calc(100vh - 60px)",
        // overflowX: "auto",
        fontFamily: "Consolas",
      },
    },
    muiTableProps: {
      sx: {
        borderSpacing: 0,
      },
    },
    muiTableHeadCellProps: {
      sx: {
        lineHeight: 1,
        fontFamily: "Consolas",
      },
    },
    muiTableBodyCellProps: {
      sx: {
        // maxHeight: "calc(100vh - 80px)",
        // overflow: "auto",
        // p: 1,
        fontSize: 10,
        fontFamily: "Consolas",
        border: "1px solid #f2f2f2",
        lineHeight: 1,
        borderCollapse: "collapse",
      },
    },
  });
  return <MaterialReactTable table={table} />;
}
