import { MantineReactTable, useMantineReactTable } from "mantine-react-table";
import {
  MaterialReactTable,
  useMaterialReactTable,
} from "material-react-table";

function Dataset1({ data, columns }: any) {
  //should be memoized or stable

  const table = useMantineReactTable({
    columns,
    data, //must be memoized or stable (useState, useMemo, defined outside of this component, etc.)
  });

  return <MantineReactTable table={table} />;
}
export default function Dataset({ data, columns }: any) {
  //should be memoized or stable

  const table = useMaterialReactTable({
    columns,
    data, //must be memoized or stable (useState, useMemo, defined outside of this component, etc.)
  });

  return (
    <MaterialReactTable
      table={table}
      initialState={{ density: "compact" }}
      enableColumnActions={true}
      enableColumnFilters={true}
      enablePagination={true}
      enableSorting={true}
      enableBottomToolbar={true}
      enableTopToolbar={true}
      muiTableBodyRowProps={{ hover: true }}
      muiTableProps={
        {
          // sx: {
          //   border: '1px solid rgba(81, 81, 81, 1)',
          // },
        }
      }
      muiTableHeadCellProps={
        {
          // sx: {
          //   border: '1px solid rgba(81, 81, 81, 1)',
          // },
        }
      }
      muiTableBodyCellProps={
        {
          // sx: {
          //   border: '1px solid rgba(81, 81, 81, 1)',
          // },
        }
      }
    />
  );
}
