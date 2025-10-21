import { DataType } from '@apache-arrow/ts';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { ListTable } from '@visactor/react-vtable';
import {
  ColumnDefine,
  ListTable as ListTableAPI,
  ListTableConstructorOptions,
  TYPES,
} from '@visactor/vtable';

import { useAtomValue } from 'jotai';
import { CSSProperties, memo, useMemo, useRef, useState } from 'react';

import { OrderByType, SchemaType } from '@/stores/dataset';
import { downloadCsv, exportVTableToCsv } from '@visactor/vtable-export';
import dayjs from 'dayjs';
import type { ComponentProps } from 'react';

import { SelectedCellType } from '@/components/views/TableView';
import { useTheme } from '@/hooks/theme-provider';
import { tableFontFamilyAtom } from '@/stores/setting';
import { isDarkTheme, isNumberType, uniqueArray } from '@/utils';
import {
  ContextMenuPlugin,
  MenuClickEventArgs,
} from '@visactor/vtable-plugins';
import { IVTablePlugin } from '@visactor/vtable/es/plugins';
import { FieldDef } from '@visactor/vtable/es/ts-types';
import { HighlightHeaderWhenSelectCellPlugin } from './highlight-header-when-select-cell';
import { makeTableTheme } from './theme';

export type ListTableProps = ComponentProps<typeof ListTable>;

export interface TableProps<T = unknown> {
  data: T[];
  schema: SchemaType[];
  beautify?: boolean;
  precision?: number;
  style?: CSSProperties;
  orderBy?: OrderByType;
  transpose?: boolean;
  cross?: boolean;
  hiddenColumns: Record<string, boolean>;
  setHiddenColumns: (col: string, hidden: boolean) => void;
  onSelectedCell?: (value: SelectedCellType | null) => void;
  onSelectedCellInfos?: (cells: SelectedCellType[][] | null) => void;
}

function useTableTheme() {
  const appTheme = useTheme();
  const isDark = isDarkTheme(appTheme);
  const tableFontFamily = useAtomValue(tableFontFamilyAtom);
  return useMemo(
    () => makeTableTheme(isDark, tableFontFamily),
    [isDark, tableFontFamily],
  );
}

const rowSeriesNumber = ({ transpose }: any) => ({
  field: '__index__',
  title: '',
  dragHeader: false,
  disableSelect: true,
  // disableHover: true,
  disableHeaderHover: true,
  disableHeaderSelect: true,
  disableColumnResize: true,
  style: { color: '#96938f', fontSize: 10, textAlign: 'center' },
  fieldFormat: (_r: any, col: number, row: number) => {
    return transpose ? col : row;
  },
});

const contextMenuItems = (
  _field: FieldDef,
  row: number,
  col: number,
  table: ListTableAPI,
) => {
  const transpose = (table as ListTableAPI)?.transpose;
  if ((!transpose && row == 0) || (transpose && col == 0)) {
    return [
      {
        menuKey: 'copy-field',
        text: 'Copy Field Name',
      },
      {
        menuKey: 'pin-to-left',
        text: 'Pin to left',
      },
      {
        menuKey: 'pin-to-right',
        text: 'Pin to right',
      },
      {
        menuKey: 'pin-to-clear',
        text: 'Clear pinned',
      },
      {
        menuKey: 'hidden-column',
        text: 'Hidden column',
      },
    ];
  }
  return [
    {
      menuKey: 'copy',
      text: 'Copy',
    },
    {
      menuKey: 'copy-as-csv',
      text: 'Copy as CSV',
    },
  ];
};

type FieldFormatParamsType = {
  key: string;
  dataType: DataType;
  type?: string;
  beautify?: boolean;
  precision?: number;
};

const handleFieldFormat = (
  record: any,
  { key, dataType, type, beautify, precision }: FieldFormatParamsType,
) => {
  const value = record[key];
  if (value === null) {
    return '<null>';
  }
  if (DataType.isDecimal(dataType)) {
    const { scale } = dataType;
    return value
      .toString()
      .padStart(scale + 1, '0')
      .replace(new RegExp(`(.{${scale}})$`), '.$1');
  }

  const templte = 'YYYY-MM-DD HH:mm:ss';
  if (DataType.isDate(dataType) && type?.toLowerCase()?.includes('datetime')) {
    return dayjs(value).format(templte);
  } else if (DataType.isDate(dataType)) {
    return dayjs(value).format('YYYY-MM-DD');
  } else if (DataType.isTimestamp(dataType)) {
    if (!dataType.timezone) {
      return dayjs(value).utc().format(templte);
    }
    return dayjs(value).format(templte);
  }

  if (beautify && DataType.isFloat(dataType) && precision) {
    try {
      return (value as number)?.toFixed(precision);
    } catch (_error) {
      return value;
    }
  }
  return value;
};

const handleColumnStyle = (
  arg: TYPES.StylePropertyFunctionArg,
  { dataType, type }: FieldFormatParamsType,
) => {
  const style: Record<string, string> = {};
  if (isNumberType(dataType) || type?.toLowerCase()?.includes('decimal')) {
    style['textAlign'] = 'right';
  }
  if (arg.dataValue === null || arg.dataValue === undefined) {
    style['color'] = 'gray';
  }
  return style;
};

function useTitles(schema: SchemaType[]) {
  const [_titles, titleMap, types] = useMemo(() => {
    const _titles = schema.map(({ name, dataType, type }) => {
      return {
        key: name,
        name,
        type: type ?? dataType.toString(),
        dataType,
      };
    });
    return [
      _titles,
      new Map(_titles.map((item) => [item.name, item])),
      new Map(_titles.map(({ key, type }) => [key, type])),
    ];
  }, [schema]);

  return { _titles, titleMap, types };
}

const CanvasTable_ = memo(function CanvasTable({
  data,
  schema,
  beautify,
  precision,
  transpose,
  cross,
  style,
  setHiddenColumns,
  hiddenColumns,
  onSelectedCell,
  onSelectedCellInfos,
}: TableProps) {
  const tableRef = useRef<ListTableAPI>(null);

  const [leftPinnedCols, setLeftPinnedCols] = useState<string[]>([]);
  const [rightPinnedCols, setRightPinnedCols] = useState<string[]>([]);

  const { _titles, titleMap, types } = useTitles(schema);

  const __columns: ColumnDefine[] = useMemo(() => {
    const pinnedSet = new Set([...leftPinnedCols, ...rightPinnedCols]);
    const __titles = [
      ...leftPinnedCols.map((key) => titleMap.get(key)),
      ..._titles.filter(({ key }) => !pinnedSet.has(key)),
      ...rightPinnedCols.map((key) => titleMap.get(key)),
    ].filter((item) => !!item);

    return __titles.map(({ key, name, dataType, type }, _) => {
      return {
        key,
        field: name,
        fieldKey: key,
        title: name,
        dragHeader: true,
        hide: hiddenColumns?.[name],
        sort: true,
        style: (arg) => handleColumnStyle(arg, { key, dataType, type }),
        fieldFormat: (record) =>
          handleFieldFormat(record, {
            key,
            dataType,
            type,
            beautify,
            precision,
          }),
      } as ColumnDefine;
    });
  }, [
    leftPinnedCols,
    rightPinnedCols,
    _titles,
    titleMap,
    beautify,
    precision,
    hiddenColumns,
  ]);

  const exportToCsv = (name: string) => {
    // TODO: test
    const table = tableRef.current;
    if (table) {
      const csv = exportVTableToCsv(table);
      downloadCsv(csv, name);
    }
  };

  const handleMouseEnterCell: ListTableProps['onMouseEnterCell'] = (args) => {
    const table = tableRef.current;
    if (!table) {
      return;
    }

    const { col, row } = args;
    const isShow = table.stateManager.menu.isShow;
    if (
      (!table.transpose && row === 0 && col !== 0 && !isShow) ||
      (table.transpose && col === 0 && row !== 0 && !isShow)
    ) {
      const rect = table.getVisibleCellRangeRelativeRect({
        col,
        row,
      });

      const name = table.getCellValue(col, row);
      const type = types.get(name);
      table.showTooltip(col, row, {
        content: `${name}: ${type}`,
        referencePosition: {
          rect,
          placement: TYPES.Placement.bottom,
        },
        className: 'defineTooltip',
        style: {
          arrowMark: false,
        },
      });
    }
  };

  const handleDropdownMenuClick: ListTableProps['onDropdownMenuClick'] = async (
    e,
  ) => {
    const table = tableRef.current;
    const transpose = table?.transpose;
    if ((!transpose && e.row == 0) || (transpose && e.col == 0)) {
      if (e.menuKey == 'copy-field') {
        await writeText((e?.field as string) ?? '');
      } else if (e.menuKey == 'pin-to-left') {
        setLeftPinnedCols((v) => uniqueArray([...v, e.field as string]));
        setRightPinnedCols((v) => v.filter((key) => key != e.field));
      } else if (e.menuKey == 'pin-to-right') {
        setRightPinnedCols((v) => uniqueArray([e.field as string, ...v]));
        setLeftPinnedCols((v) => v.filter((key) => key != e.field));
      } else if (e.menuKey == 'pin-to-clear') {
        setLeftPinnedCols([]);
        setRightPinnedCols([]);
      } else if (e.menuKey == 'hidden-column') {
        setHiddenColumns(e.field as string, true);
      }
    } else {
      if (e.menuKey == 'copy') {
        await writeText(table?.getCopyValue() ?? '');
      } else if (e.menuKey == 'copy-as-csv') {
        const rows =
          table?.getSelectedCellInfos()?.map((row) => {
            return row.map((item) => item.dataValue).join(',');
          }) ?? [];

        await writeText(rows.join('\n'));
      }
    }
  };

  const handleDragSelectEnd: ListTableProps['onDragSelectEnd'] = (e) => {
    onSelectedCellInfos?.(e.cells as SelectedCellType[][]);
  };
  const theme = useTableTheme();

  const highlightPlugin = useMemo(
    () =>
      new HighlightHeaderWhenSelectCellPlugin({
        colHighlight: true,
        rowHighlight: true,
      }),
    [],
  );

  const contextMenuPlugin = useMemo(() => {
    return new ContextMenuPlugin({
      bodyCellMenuItems: [
        {
          text: 'Copy',
          menuKey: 'copy',
          shortcut: 'Ctrl+C',
        },
        {
          text: 'Copy as CSV',
          menuKey: 'copy-as-csv',
        },
      ],
      headerCellMenuItems: [
        {
          menuKey: 'copy-field',
          text: 'Copy Field Name',
        },
        {
          menuKey: 'pin-to-left',
          text: 'Pin to left',
        },
        {
          menuKey: 'pin-to-right',
          text: 'Pin to right',
        },
        {
          menuKey: 'pin-to-clear',
          text: 'Clear pinned',
        },
        {
          menuKey: 'hidden_column',
          text: 'Hidden column',
        },
      ],

      menuClickCallback: async (e: MenuClickEventArgs, table: ListTableAPI) => {
        if (e.colIndex === undefined || e.rowIndex === undefined) {
          return;
        }
        const field = table.getCellValue(e.colIndex, e.rowIndex);
        const menuKey = e.menuKey as string;
        const transpose = table?.transpose;
        if (!transpose) {
          if (menuKey === 'copy-field') {
            await writeText((field as string) ?? '');
          } else if (menuKey == 'pin-to-left') {
            setLeftPinnedCols((v) => uniqueArray([...v, field as string]));
            setRightPinnedCols((v) => v.filter((key) => key != field));
          } else if (menuKey == 'pin-to-right') {
            setRightPinnedCols((v) => uniqueArray([field as string, ...v]));
            setLeftPinnedCols((v) => v.filter((key) => key != field));
          } else if (menuKey == 'pin-to-clear') {
            setLeftPinnedCols([]);
            setRightPinnedCols([]);
          } else if (menuKey == 'hidden_column') {
            setHiddenColumns(field as string, true);
          }
        }
        if (menuKey == 'copy') {
          await writeText(table?.getCopyValue() ?? '');
        } else if (menuKey == 'copy-as-csv') {
          const rows =
            table?.getSelectedCellInfos()?.map((row) => {
              return row.map((item) => item.dataValue).join(',');
            }) ?? [];

          await writeText(rows.join('\n'));
        }
      },
    });
  }, [setHiddenColumns]);

  const [plugins, setPlugins] = useState<IVTablePlugin[]>([highlightPlugin]);

  const option: ListTableConstructorOptions = useMemo(() => {
    console.log('plugins:', plugins);
    return {
      records: data,
      limitMaxAutoWidth: 200,
      heightMode: 'standard',
      defaultRowHeight: 24,
      widthMode: 'autoWidth',
      showFrozenIcon: true,
      frozenColCount: transpose ? 2 : 1 + leftPinnedCols.length,
      rightFrozenColCount: rightPinnedCols.length,
      frozenRowCount: 0,
      theme,
      transpose,
      rowSeriesNumber: {
        title: '',
        width: 'auto',
        headerStyle: {},
        style: { color: '#96938f', fontSize: 10, textAlign: 'center' },
        dragOrder: false,
        disableColumnResize: true,
      },
      columns: [...__columns],
      menu: {},
      hover: {
        highlightMode: 'cell',
      },
      select: {
        headerSelectMode: 'cell',
        highlightMode: cross ? 'cross' : 'row',
      },
      keyboardOptions: {
        moveEditCellOnArrowKeys: true,
        copySelected: true,
        pasteValueToCell: true,
      },
      plugins: plugins.length > 0 ? plugins : [],
    };
  }, [
    plugins,
    data,
    transpose,
    leftPinnedCols.length,
    rightPinnedCols.length,
    theme,
    __columns,
    cross,
  ]);

  return (
    <div className="h-full select-text" style={style}>
      <ListTable
        ref={tableRef}
        option={option}
        keepColumnWidthChange={true}
        onContextMenuCell={(arg) => {
          console.log('context', arg);
        }}
        onMouseDownCell={({ col, row }) => {
          const table = tableRef.current;
          if (table) {
            const value = table.getCellRawValue(col, row);
            onSelectedCell?.({ col, row, value });
          }
        }}
        // onDropdownMenuClick={handleDropdownMenuClick}
        onMouseEnterCell={handleMouseEnterCell}
        onDragSelectEnd={handleDragSelectEnd}
        onResizeColumnEnd={() => {
          const widths = tableRef.current?.colWidthsMap;
          console.log('new widths', widths);
        }}
        onReady={(tableInstance, isFirst) => {
          console.log('表格初始化完成');
          console.log(tableInstance);
          if (isFirst) {
            tableRef.current = tableInstance as ListTableAPI;
            setPlugins([highlightPlugin, contextMenuPlugin]);
            console.log('表格首次初始化');
          }
        }}
      />
    </div>
  );
});

export const CanvasTable = (props: TableProps) => {
  if ((props.schema?.length ?? 0) == 0) {
    return null;
  }
  return <CanvasTable_ {...props} />;
};

export function SimpleTable({ data }: { data: unknown[] }) {
  const tableRef = useRef<ListTableAPI>(null);
  const theme = useTableTheme();

  const option: ListTableConstructorOptions = useMemo(
    () => ({
      records: data,
      limitMaxAutoWidth: 200,
      // heightMode: 'autoHeight',
      heightMode: 'standard',
      defaultRowHeight: 28,
      widthMode: 'autoWidth',
      showFrozenIcon: true,
      theme,
      columns: [
        {
          field: '__index__',
          title: '',
          dragHeader: false,
          disableSelect: true,
          // disableHover: true,
          disableHeaderHover: true,
          disableHeaderSelect: true,
          disableColumnResize: true,
          style: { color: '#96938f', fontSize: 10, textAlign: 'center' },
          fieldFormat: (_r, _col, row) => {
            return row;
          },
        },
        ...Object.keys(data[0] ?? {}).map((key) => {
          return {
            field: key,
            title: key,
            dragHeader: true,
            sort: true,
          } as ColumnDefine;
        }),
      ],
      hover: {
        highlightMode: 'row',
      },
      keyboardOptions: {
        moveEditCellOnArrowKeys: true,
        copySelected: true,
        pasteValueToCell: true,
      },
      plugins: [],
    }),
    [data, theme],
  );

  return (
    <div className="h-full">
      <ListTable ref={tableRef} option={option} />
    </div>
  );
}
