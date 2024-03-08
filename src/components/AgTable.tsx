import { Box, BoxProps, styled, useTheme } from '@mui/material';
import { CellStyle } from 'ag-grid-community/dist/lib/entities/colDef';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { AgGridReact } from 'ag-grid-react';
import dayjs from 'dayjs';
import {
  CSSProperties,
  ComponentProps,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { NonUndefined } from 'react-hook-form';

import HeaderCell from '@/components/dataframe/HeaderCell';
import { OrderByType, SchemaType } from '@/stores/dataset';
import { getByteLength, isDarkTheme, isNumber } from '@/utils';

export interface TableProps<T = unknown> {
  data: T[];
  schema: SchemaType[];
  beautify?: boolean;
  precision?: number;
  style?: CSSProperties;
  orderBy?: OrderByType;
  transpose?: boolean;
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

const formatter = ({
  dataType,
  precision,
  beautify,
}: {
  dataType: string;
  precision: number;
  beautify?: boolean;
}) =>
  (({ value }) => {
    if (value === null) {
      return '[NULL]';
    }
    if (dataType.includes('Date32')) {
      return dayjs(value as string)?.format('YYYY-MM-DD');
    }
    if (dataType.includes('Date64')) {
      return dayjs(value as string)?.format('YYYY-MM-DD HH:mm:ss');
    }
    if (beautify && dataType.includes('Float')) {
      try {
        return (value as number)?.toFixed(precision);
      } catch (error) {
        return value;
      }
    }
    return value;
  }) as ColDefType['valueFormatter'];

type ColDefType = NonUndefined<
  ComponentProps<typeof AgGridReact>['defaultColDef']
>;

export const AgTable = ({
  data,
  schema,
  beautify,
  orderBy,
  precision,
  ...rest
}: TableProps) => {
  const gridRef = useRef<AgGridReact | null>(null);
  const theme = useTheme();

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
      schema?.map(({ name, dataType, type }) => {
        return {
          headerName: name,
          field: name,
          sqlType: type ?? dataType,
          width: columnWiths(name, row0),
          valueFormatter: formatter({
            dataType,
            precision,
            beautify,
          }),

          cellStyle: (({ value }) => {
            const style: CellStyle = {};
            if (value === null) {
              style['color'] = 'gray';
            }
            if (isNumber(dataType)) {
              style['textAlign'] = 'right';
            }
            return style;
          }) as ColDefType['cellStyle'],
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
