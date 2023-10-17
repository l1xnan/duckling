import { useCallback, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import { getByteLength, isDarkTheme } from "@/utils";
import { Box, useTheme } from "@mui/material";
import { SchemaType, useStore } from "@/stores/store";
import HeaderCell from "./HeaderCell";

interface TableProps {
  data: any[];
  schema: SchemaType[];
}

export const GridExample = ({ data, schema }: TableProps) => {
  const gridRef = useRef<AgGridReact | null>(null);
  const theme = useTheme();

  const indexStyle = useMemo(
    () => ({
      color: isDarkTheme(theme) ? "#aeb3c2" : "#aeb3c2",
    }),

    [theme]
  );
  const components = useMemo(() => {
    return {
      agColumnHeader: HeaderCell,
    };
  }, []);

  const row0 = data?.[0] ?? {};
  const columnDefs = useMemo<any[]>(() => {
    const main: any[] =
      schema?.map(({ name, dataType }) => {
        return {
          headerName: name,
          field: name,
          width: Math.min(
            Math.max(
              getByteLength(name),
              getByteLength(row0?.[name]?.toString() ?? "0")
            ) *
              12 +
              30,
            200
          ),
        };
      }) ?? [];

    return [
      {
        headerName: " ",
        colId: "__index__",
        valueGetter: "node.id",
        width: 50,
        cellStyle: {
          textAlign: "center",
          ...indexStyle,
        },
        resizable: false,
        pinned: "left",
        type: "rightAligned",
      },
      ...main,
    ];
  }, [schema]);

  const clearPinned = useCallback(() => {
    if (!gridRef.current) {
      return;
    }
    gridRef.current.columnApi.applyColumnState({
      defaultState: { pinned: null },
    });
  }, []);

  const resetPinned = useCallback(() => {
    if (!gridRef.current) {
      return;
    }
    gridRef.current.columnApi.applyColumnState({
      state: [
        { colId: "rowNum", pinned: "left" },
        { colId: "athlete", pinned: "left" },
        { colId: "age", pinned: "left" },
        { colId: "total", pinned: "right" },
      ],
      defaultState: { pinned: null },
    });
  }, []);

  const pinCountry = useCallback(() => {
    if (!gridRef.current) {
      return;
    }
    gridRef.current.columnApi.applyColumnState({
      state: [{ colId: "country", pinned: "left" }],
      defaultState: { pinned: null },
    });
  }, []);

  const jumpToCol = useCallback(() => {
    const value = document.getElementById("col").value;
    if (typeof value !== "string" || value === "") {
      return;
    }
    const index = Number(value);
    if (typeof index !== "number" || isNaN(index)) {
      return;
    }
    // it's actually a column the api needs, so look the column up
    const allColumns = gridRef.current.columnApi.getColumns();
    if (allColumns) {
      const column = allColumns[index];
      if (column) {
        gridRef.current.api.ensureColumnVisible(column);
      }
    }
  }, []);

  const jumpToRow = useCallback(() => {
    var value = document.getElementById("row").value;
    const index = Number(value);
    if (typeof index === "number" && !isNaN(index)) {
      gridRef.current.api.ensureIndexVisible(index);
    }
  }, []);

  const orderBy = useStore((state) => state.orderBy);

  const defaultColDef = useMemo(() => {
    return {
      width: 150,
      sortable: true,
      resizable: true,
      cellDataType: false,
      enableRowGroup: true,
      enablePivot: true,
      enableValue: true,
      headerComponentParams: {
        orderBy,
      },
    };
  }, []);
  return (
    <Box
      sx={{
        width: "100%",
        height: "calc(100vh - 64px)",

        "&": {
          "--ag-grid-size": "4px",
          //   "--ag-borders": "none",
          "--ag-row-height": "25px",
          "--ag-list-item-height": "30px",
          "--ag-font-size": "10px",
          "--ag-font-family": `Consolas, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif`,
          "--ag-border-color": isDarkTheme(theme) ? "#313438" : "#ebecf0",
          "--ag-cell-horizontal-border": isDarkTheme(theme)
            ? "1px solid #313438"
            : "1px solid #ebecf0",
        },
        "& .ag-root-wrapper": {
          border: "none",
        },
        "& .ag-header-cell": {
          border: isDarkTheme(theme)
            ? "1px solid #313438"
            : "1px solid #ebecf0",
        },
        "& .ag-header-cell-resize": {
          opacity: 0,
        },
        "& .ag-cell": {
          borderBottom: "none",
          borderTop: "none",
        },
      }}
      className={
        isDarkTheme(theme) ? "ag-theme-alpine-dark" : "ag-theme-alpine"
      }
    >
      <AgGridReact
        ref={gridRef}
        rowData={data}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        components={components}
      />
    </Box>
  );
};
