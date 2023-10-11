import { MantineReactTable, useMantineReactTable } from "mantine-react-table";

export default function Dataset({ data, columns }: any) {
  //should be memoized or stable

  const table = useMantineReactTable({
    columns,
    data, //must be memoized or stable (useState, useMemo, defined outside of this component, etc.)
  });

  return <MantineReactTable table={table} />;
}
