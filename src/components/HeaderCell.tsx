import { usePageStore } from "@/stores/store";
import { Box } from "@mui/material";
import {
  IconCaretDownFilled,
  IconCaretUpDownFilled,
  IconCaretUpFilled,
} from "@tabler/icons-react";

// https://ag-grid.com/react-data-grid/component-header/

interface HeadCellProps {
  displayName: string;
  column: {
    colId: string;
  };
}

export default (props: HeadCellProps) => {
  const { orderBy, setOrderBy } = usePageStore();

  const key = props.column.colId;
  let isDesc = orderBy?.name == key ? orderBy?.desc : undefined;

  if (props.column.colId == "__index__") {
    return;
  }

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
        fontSize: "14px",
      }}
      onClick={() => {
        setOrderBy(key);
      }}
    >
      <Box sx={{}}>{props.displayName}</Box>
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
};
