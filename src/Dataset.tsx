import { MantineReactTable, useMantineReactTable } from "mantine-react-table";
import {
  MaterialReactTable,
  useMaterialReactTable,
} from "material-react-table";
import { useEffect, useRef, useState } from "react";

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

  // const table = useMaterialReactTable({
  //   columns,
  //   data, //must be memoized or stable (useState, useMemo, defined outside of this component, etc.)
  // });

  //optionally access the underlying virtualizer instance
  const rowVirtualizerInstanceRef = useRef(null);

  return (
    <MaterialReactTable
      columns={columns}
      data={data} //10,000 rows
      defaultDisplayColumn={{ enableResizing: true }}
      enableBottomToolbar={false}
      enableColumnResizing
      enableColumnVirtualization
      enableGlobalFilterModes
      enablePagination={false}
      enablePinning
      enableRowNumbers
      enableRowVirtualization
      muiTableContainerProps={{ sx: { maxHeight: "600px" } }}
      rowVirtualizerInstanceRef={rowVirtualizerInstanceRef} //optional
      rowVirtualizerProps={{ overscan: 5 }} //optionally customize the row virtualizer
      columnVirtualizerProps={{ overscan: 2 }} //optionally customize the column virtualizer
    />
  );
}
