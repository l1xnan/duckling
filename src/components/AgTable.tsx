import { Box, BoxProps, styled, useTheme } from '@mui/material';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { AgGridReact } from 'ag-grid-react';
import dayjs from 'dayjs';
import { useAtomValue } from 'jotai';
import { CSSProperties, useCallback, useMemo, useRef } from 'react';

import HeaderCell from '@/components/dataframe/HeaderCell';
import { SchemaType, usePageStore } from '@/stores/dataset';
import { precisionAtom } from '@/stores/setting';
import { getByteLength, isDarkTheme } from '@/utils';

interface TableProps<T = unknown> {
  data: T[];
  schema: SchemaType[];
  beautify?: boolean;
  style?: CSSProperties;
}

type RowType = Record<string, unknown>;

function columnWiths(name: string, row: RowType) {
  return Math.min(
    Math.max(
      getByteLength(name),
      getByteLength(row?.[name]?.toString() ?? '0'),
    ) *
      12 +
      30,
    200,
  );
}

function isNumber(dataType: string) {
  return (
    dataType.includes('Int') ||
    dataType.includes('Float') ||
    dataType.includes('Decimal')
  );
}

export const AgTable = ({ data, schema, beautify, ...rest }: TableProps) => {
  const gridRef = useRef<AgGridReact | null>(null);
  const theme = useTheme();
  const precision = useAtomValue(precisionAtom);

  const indexStyle = useMemo(
    () => ({
      color: isDarkTheme(theme) ? '#aeb3c2' : '#aeb3c2',
    }),

    [theme],
  );
  const components = useMemo(() => {
    return {
      agColumnHeader: HeaderCell,
    };
  }, []);
  const row0 = (data?.[0] ?? {}) as RowType;
  const columnDefs = useMemo<RowType[]>(() => {
    const main: RowType[] =
      schema?.map(({ name, dataType }) => {
        return {
          headerName: name,
          field: name,
          width: columnWiths(name, row0),
          valueFormatter: dataType.includes('Date32')
            ? (params: any) => {
                return dayjs(params.value)?.format('YYYY-MM-DD');
              }
            : beautify && dataType.includes('Float')
              ? (params: any) => {
                  try {
                    return params.value?.toFixed(precision);
                  } catch (error) {
                    return params.value;
                  }
                }
              : undefined,

          cellStyle: isNumber(dataType)
            ? {
                textAlign: 'right',
              }
            : undefined,
        };
      }) ?? [];

    return [
      {
        headerName: ' ',
        colId: '__index__',
        valueGetter: 'node.rowIndex + 1',
        width: 60,
        cellStyle: {
          textAlign: 'center',
          ...indexStyle,
        },
        resizable: false,
        pinned: 'left',
        lockPinned: true,
        type: 'rightAligned',
      },
      ...main,
    ];
  }, [schema, beautify]);

  const clearPinned = useCallback(() => {
    gridRef.current?.api.applyColumnState({
      state: [{ colId: '__index__', pinned: 'left' }],
      defaultState: { pinned: null },
    });
  }, []);

  const { orderBy } = usePageStore();

  const defaultColDef = useMemo(() => {
    return {
      width: 150,
      sortable: true,
      resizable: true,
      cellDataType: false,
      enablePivot: true,
      enableValue: true,
      headerComponentParams: {
        orderBy,
      },
    };
  }, []);

  const className = isDarkTheme(theme)
    ? 'ag-theme-alpine-dark'
    : 'ag-theme-alpine';

  return (
    <TableWrapper className={className} style={rest.style}>
      <AgGridReact
        ref={gridRef}
        rowData={data}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        components={components}
      />
    </TableWrapper>
  );
};

export const TableWrapper = styled((props: BoxProps) => <Box {...props} />)(
  ({ theme }) => ({
    width: '100%',
    height: '100%',
    '&': {
      '--ag-grid-size': '4px',
      //   "--ag-borders": "none",
      '--ag-row-height': '25px',
      '--ag-list-item-height': '30px',
      '--ag-font-size': '10px',
      '--ag-font-family': `var(--table-font-family)`,
      '--ag-border-color': isDarkTheme(theme) ? '#313438' : '#ebecf0',
      '--ag-cell-horizontal-border': isDarkTheme(theme)
        ? '1px solid #313438'
        : '1px solid #ebecf0',
    },
    '& .ag-root-wrapper': {
      border: 'none',
    },
    '& .ag-header-cell': {
      border: isDarkTheme(theme) ? '1px solid #313438' : '1px solid #ebecf0',
    },
    '& .ag-header-cell-resize': {
      opacity: 0,
    },
    '& .ag-cell': {
      borderBottom: 'none',
      borderTop: 'none',
    },
  }),
);
