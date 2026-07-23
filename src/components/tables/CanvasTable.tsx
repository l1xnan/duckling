import { DataType } from '@apache-arrow/ts';
import { msg } from '@lingui/core/macro';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { ListTable } from '@visactor/react-vtable';
import {
  ColumnDefine,
  ListTable as ListTableAPI,
  ListTableConstructorOptions,
  TYPES,
} from '@visactor/vtable';
import {
  ContextMenuPlugin,
  MenuClickEventArgs
} from '@visactor/vtable-plugins';
import { IVTablePlugin } from '@visactor/vtable/es/plugins';

import type { ComponentProps } from 'react';
import { CSSProperties, useMemo, useRef, useState } from 'react';

import { SelectedCellType } from '@/components/views/TableView';
import { useTheme } from '@/hooks/theme-provider';
import { useResolvedColorTheme } from '@/hooks/use-color-theme';
import { i18n } from '@/i18n';
import { OrderByType, SchemaType } from '@/stores/dataset';
import { useTableFontFamily, useTableFontSize } from '@/stores/setting';
import { isDarkTheme, isNumberType, uniqueArray } from '@/utils';

import { formatHotkey, getHotkey } from '@/hotkeys';

import { handleFieldFormat } from './format';
import { HighlightHeaderWhenSelectCellPlugin } from './highlight-header-when-select-cell';
import {
  iconCopy,
  iconCopyCsv,
  iconCountBy,
  iconField,
  iconFilter,
  iconHide,
  iconPinClear,
  iconPinLeft,
  iconPinRight,
  iconPivot,
  iconProfile,
  iconSortAsc,
  iconSortClear,
  iconSortDesc,
} from './menuIcons';
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
  /** Header context menu: count distinct values for this column. */
  onCountByColumn?: (columnName: string) => void;
  /** Header context menu: column profile (null/distinct/min/max/top-N). */
  onProfileColumn?: (columnName: string) => void;
  /** Header context menu: open pivot with this column as a row dimension. */
  onPivotColumn?: (columnName: string) => void;
  /**
   * When set, header sort uses this callback (server-side) instead of
   * VTable client-side sorting.
   */
  onOrderByColumn?: (
    columnName: string,
    options?: { desc?: boolean; clear?: boolean },
  ) => void;
  /** Body cell: filter table by this cell value (drill-down). */
  onDrillDown?: (columnName: string, value: unknown) => void;
}

function useTableTheme() {
  const { isDark, tokens } = useResolvedColorTheme();
  const tableFontFamily = useTableFontFamily();
  const tableFontSize = useTableFontSize();
  return useMemo(
    () =>
      makeTableTheme({
        isDark,
        tokens,
        tableFontFamily,
        tableFontSize,
      }),
    [isDark, tokens, tableFontFamily, tableFontSize],
  );
}

const MENU_COPY_FIELD = msg`Copy Field Name`;
const MENU_PIN_LEFT = msg`Pin to left`;
const MENU_PIN_RIGHT = msg`Pin to right`;
const MENU_PIN_CLEAR = msg`Clear pinned`;
const MENU_HIDDEN_COLUMN = msg`Hidden column`;
const MENU_COUNT_BY_COLUMN = msg`Count by this column`;
const MENU_COLUMN_PROFILE = msg`Column profile`;
const MENU_PIVOT_COLUMN = msg`Pivot with this column`;
const MENU_FILTER_BY_VALUE = msg`Filter by this value`;
const MENU_COPY = msg`Copy`;
const MENU_COPY_AS_CSV = msg`Copy as CSV`;

const copySelectedAsCsv = async (table: ListTableAPI | null) => {
  if (!table) {
    return;
  }
  const cellInfos = table.getSelectedCellInfos();
  if (!cellInfos || cellInfos.length === 0) {
    return;
  }
  const transpose = table.transpose;
  const firstRow = cellInfos[0];
  const includesHeader =
    (!transpose && firstRow.some((cell) => cell.row === 0)) ||
    (!!transpose && firstRow.some((cell) => cell.col === 0));

  const rows = cellInfos.map((row) =>
    row.map((item) => item.dataValue).join(','),
  );

  if (includesHeader) {
    await writeText(rows.join('\n'));
    return;
  }

  const headerRow = firstRow
    .map((cell) =>
      transpose
        ? table.getCellValue(0, cell.row)
        : table.getCellValue(cell.col, 0),
    )
    .join(',');

  await writeText([headerRow, ...rows].join('\n'));
};

type FieldFormatParamsType = {
  key: string;
  dataType: DataType;
  type?: string;
  beautify?: boolean;
  precision?: number;
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
  } else if (arg.dataValue === '') {
    style['color'] = '#c2410c';
    style['fontStyle'] = 'italic';
  } else if (
    typeof arg.dataValue === 'number' &&
    !Number.isFinite(arg.dataValue)
  ) {
    style['color'] = '#dc2626';
    style['fontWeight'] = 'bold';
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

function CanvasTable_({
  data,
  schema,
  beautify,
  precision,
  transpose,
  cross,
  style,
  orderBy,
  setHiddenColumns,
  hiddenColumns,
  onSelectedCell,
  onSelectedCellInfos,
  onCountByColumn,
  onProfileColumn,
  onPivotColumn,
  onOrderByColumn,
  onDrillDown,
}: TableProps) {
  const tableRef = useRef<ListTableAPI>(null);

  const [leftPinnedCols, setLeftPinnedCols] = useState<string[]>([]);
  const [rightPinnedCols, setRightPinnedCols] = useState<string[]>([]);

  const { _titles, titleMap, types } = useTitles(schema);

  const appTheme = useTheme();
  const isDark = isDarkTheme(appTheme);

  const __columns: ColumnDefine[] = useMemo(() => {
    const pinnedSet = new Set([...leftPinnedCols, ...rightPinnedCols]);
    const __titles = [
      ...leftPinnedCols.map((key) => titleMap.get(key)),
      ..._titles.filter(({ key }) => !pinnedSet.has(key)),
      ...rightPinnedCols.map((key) => titleMap.get(key)),
    ].filter((item) => !!item);

    return __titles.map(({ key, name, dataType, type }, _) => {
      const isSorted = orderBy?.name === name;
      return {
        key,
        field: name,
        fieldKey: key,
        title: isSorted
          ? `${name} ${orderBy?.desc ? '↓' : '↑'}`
          : name,
        dragHeader: true,
        hide: hiddenColumns?.[name],
        // Disable VTable client sort when server-side handler is provided.
        sort: onOrderByColumn
          ? false
          : true,
        style: (arg) => handleColumnStyle(arg, { key, dataType, type }),
        fieldFormat: (record) =>
          handleFieldFormat(record, {
            key,
            dataType,
            type,
            beautify,
            precision,
          }),
        headerStyle: isSorted
          ? { fontWeight: 'bold' as const }
          : undefined,
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
    orderBy,
    onOrderByColumn,
  ]);

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

  const handleDragSelectEnd: ListTableProps['onDragSelectEnd'] = (e) => {
    onSelectedCellInfos?.(e.cells as SelectedCellType[][]);
  };
  const theme = useTableTheme();

  const highlightPlugin = useMemo(
    () =>
      new HighlightHeaderWhenSelectCellPlugin({
        colHighlight: true,
        rowHighlight: true,
        colHighlightBGColor: isDark ? '#9cbef4' : '#CCE0FF',
        colHighlightColor: '#1f2937',
        rowHighlightBGColor: isDark ? '#9cbef4' : '#CCE0FF',
        rowHighlightColor: '#1f2937',
      }),
    [isDark],
  );

  const contextMenuPlugin = useMemo(() => {
    type MenuEntry =
      | string
      | {
          text: string;
          menuKey: string;
          shortcut?: string;
          customIcon?: { svg: string; width?: number; height?: number };
        };

    const joinGroups = (...groups: MenuEntry[][]): MenuEntry[] => {
      const out: MenuEntry[] = [];
      for (const g of groups) {
        if (!g.length) continue;
        if (out.length) out.push('---');
        out.push(...g);
      }
      return out;
    };

    const bodyCopyGroup: MenuEntry[] = [
      {
        text: i18n._(MENU_COPY),
        menuKey: 'copy',
        shortcut: formatHotkey(getHotkey('table.copy')),
        customIcon: iconCopy,
      },
      {
        text: i18n._(MENU_COPY_AS_CSV),
        menuKey: 'copy-as-csv',
        customIcon: iconCopyCsv,
      },
    ];
    const bodyFilterGroup: MenuEntry[] = onDrillDown
      ? [
          {
            text: i18n._(MENU_FILTER_BY_VALUE),
            menuKey: 'filter-by-value',
            customIcon: iconFilter,
          },
        ]
      : [];

    const headerCopyGroup: MenuEntry[] = [
      {
        menuKey: 'copy-field',
        text: i18n._(MENU_COPY_FIELD),
        customIcon: iconField,
      },
    ];
    const headerSortGroup: MenuEntry[] = onOrderByColumn
      ? [
          {
            menuKey: 'sort-asc',
            text: i18n._(msg`Sort ascending`),
            customIcon: iconSortAsc,
          },
          {
            menuKey: 'sort-desc',
            text: i18n._(msg`Sort descending`),
            customIcon: iconSortDesc,
          },
          {
            menuKey: 'sort-clear',
            text: i18n._(msg`Clear sort`),
            customIcon: iconSortClear,
          },
        ]
      : [];
    const headerAnalyzeGroup: MenuEntry[] = [
      {
        menuKey: 'count-by-column',
        text: i18n._(MENU_COUNT_BY_COLUMN),
        customIcon: iconCountBy,
      },
      ...(onProfileColumn
        ? [
            {
              menuKey: 'column-profile',
              text: i18n._(MENU_COLUMN_PROFILE),
              customIcon: iconProfile,
            },
          ]
        : []),
      ...(onPivotColumn
        ? [
            {
              menuKey: 'pivot-column',
              text: i18n._(MENU_PIVOT_COLUMN),
              customIcon: iconPivot,
            },
          ]
        : []),
    ];
    const headerLayoutGroup: MenuEntry[] = [
      {
        menuKey: 'pin-to-left',
        text: i18n._(MENU_PIN_LEFT),
        customIcon: iconPinLeft,
      },
      {
        menuKey: 'pin-to-right',
        text: i18n._(MENU_PIN_RIGHT),
        customIcon: iconPinRight,
      },
      {
        menuKey: 'pin-to-clear',
        text: i18n._(MENU_PIN_CLEAR),
        customIcon: iconPinClear,
      },
      {
        menuKey: 'hidden_column',
        text: i18n._(MENU_HIDDEN_COLUMN),
        customIcon: iconHide,
      },
    ];

    return new ContextMenuPlugin({
      bodyCellMenuItems: joinGroups(bodyCopyGroup, bodyFilterGroup),
      headerCellMenuItems: joinGroups(
        headerCopyGroup,
        headerSortGroup,
        headerAnalyzeGroup,
        headerLayoutGroup,
      ),

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
          } else if (menuKey === 'sort-asc') {
            const col = String(field ?? '').replace(/\s*[↑↓]\s*$/, '').trim();
            if (col) onOrderByColumn?.(col, { desc: false });
          } else if (menuKey === 'sort-desc') {
            const col = String(field ?? '').replace(/\s*[↑↓]\s*$/, '').trim();
            if (col) onOrderByColumn?.(col, { desc: true });
          } else if (menuKey === 'sort-clear') {
            const col = String(field ?? '').replace(/\s*[↑↓]\s*$/, '').trim();
            if (col) onOrderByColumn?.(col, { clear: true });
          } else if (menuKey === 'count-by-column') {
            const col = String(field ?? '').replace(/\s*[↑↓]\s*$/, '').trim();
            onCountByColumn?.(col);
          } else if (menuKey === 'column-profile') {
            const col = String(field ?? '').replace(/\s*[↑↓]\s*$/, '').trim();
            onProfileColumn?.(col);
          } else if (menuKey === 'pivot-column') {
            const col = String(field ?? '').replace(/\s*[↑↓]\s*$/, '').trim();
            if (col) onPivotColumn?.(col);
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
          await copySelectedAsCsv(table);
        } else if (menuKey == 'filter-by-value' && onDrillDown) {
          const value = table.getCellRawValue(e.colIndex, e.rowIndex);
          const define = table.getBodyColumnDefine?.(
            e.colIndex,
            e.rowIndex,
          ) as { field?: string; title?: string; key?: string } | undefined;
          const fieldKey =
            define?.field ??
            define?.key ??
            define?.title ??
            table.getCellValue(e.colIndex, 0);
          const colName = String(fieldKey ?? '')
            .replace(/\s*[↑↓]\s*$/, '')
            .trim();
          if (colName) onDrillDown(colName, value);
        }
      },
    });
  }, [
    setHiddenColumns,
    onCountByColumn,
    onProfileColumn,
    onPivotColumn,
    onOrderByColumn,
    onDrillDown,
    orderBy,
    i18n.locale,
  ]);

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
      rowSeriesNumber: !transpose
        ? {
            title: '',
            width: 'auto',
            headerStyle: {},
            style: { color: '#818181', fontSize: 10, textAlign: 'center' },
            dragOrder: false,
            disableColumnResize: true,
            disableHover: true,
          }
        : undefined,
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
        key={isDark ? 'dark' : 'light'}
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
}

export const CanvasTable = (props: TableProps) => {
  if ((props.schema?.length ?? 0) == 0) {
    return null;
  }
  return <CanvasTable_ {...props} />;
};

export type SimpleTableProps = {
  data: unknown[];
  hiddenColumns?: Record<string, boolean>;
  setHiddenColumns?: (col: string, hidden: boolean) => void;
  /** Body context menu: open the selected row as a table tab. */
  onOpenTable?: (row: Record<string, unknown>) => void;
};

export function SimpleTable({
  data,
  hiddenColumns,
  setHiddenColumns,
  onOpenTable,
}: SimpleTableProps) {
  const tableRef = useRef<ListTableAPI>(null);
  const theme = useTableTheme();
  const [plugins, setPlugins] = useState<IVTablePlugin[]>([]);

  const columnKeys = useMemo(
    () => Object.keys((data[0] as Record<string, unknown>) ?? {}),
    [data],
  );

  const contextMenuPlugin = useMemo(() => {
    type MenuEntry =
      | string
      | {
          text: string;
          menuKey: string;
          shortcut?: string;
          customIcon?: { svg: string; width?: number; height?: number };
        };

    const joinGroups = (...groups: MenuEntry[][]): MenuEntry[] => {
      const out: MenuEntry[] = [];
      for (const g of groups) {
        if (!g.length) continue;
        if (out.length) out.push('---');
        out.push(...g);
      }
      return out;
    };

    const bodyCopyGroup: MenuEntry[] = [
      {
        text: i18n._(MENU_COPY),
        menuKey: 'copy',
        shortcut: formatHotkey(getHotkey('table.copy')),
        customIcon: iconCopy,
      },
      {
        text: i18n._(MENU_COPY_AS_CSV),
        menuKey: 'copy-as-csv',
        customIcon: iconCopyCsv,
      },
    ];
    const bodyOpenGroup: MenuEntry[] = onOpenTable
      ? [
          {
            text: i18n._(msg`Open table`),
            menuKey: 'open-table',
            customIcon: iconField,
          },
        ]
      : [];
    const headerCopyGroup: MenuEntry[] = [
      {
        menuKey: 'copy-field',
        text: i18n._(MENU_COPY_FIELD),
        customIcon: iconField,
      },
    ];
    const headerLayoutGroup: MenuEntry[] = setHiddenColumns
      ? [
          {
            menuKey: 'hidden_column',
            text: i18n._(MENU_HIDDEN_COLUMN),
            customIcon: iconHide,
          },
        ]
      : [];

    return new ContextMenuPlugin({
      bodyCellMenuItems: joinGroups(bodyCopyGroup, bodyOpenGroup),
      headerCellMenuItems: joinGroups(headerCopyGroup, headerLayoutGroup),
      menuClickCallback: async (e: MenuClickEventArgs, table: ListTableAPI) => {
        if (e.colIndex === undefined || e.rowIndex === undefined) {
          return;
        }
        const menuKey = e.menuKey as string;
        const field = table.getCellValue(e.colIndex, e.rowIndex);

        if (menuKey === 'copy-field') {
          await writeText(String(field ?? ''));
        } else if (menuKey === 'hidden_column' && setHiddenColumns) {
          const colName = String(field ?? '').trim();
          if (colName) setHiddenColumns(colName, true);
        } else if (menuKey === 'copy') {
          await writeText(table?.getCopyValue() ?? '');
        } else if (menuKey === 'copy-as-csv') {
          await copySelectedAsCsv(table);
        } else if (menuKey === 'open-table' && onOpenTable) {
          const record = table.getRecordByCell?.(
            e.colIndex,
            e.rowIndex,
          ) as Record<string, unknown> | undefined;
          if (record) onOpenTable(record);
        }
      },
    });
  }, [setHiddenColumns, onOpenTable, i18n.locale]);

  const option: ListTableConstructorOptions = useMemo(
    () => ({
      records: data,
      limitMaxAutoWidth: 200,
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
          disableHeaderHover: true,
          disableHeaderSelect: true,
          disableColumnResize: true,
          disableHover: true,
          style: { color: '#838383', fontSize: 10, textAlign: 'center' },
          fieldFormat: (_r, _col, row) => {
            return row;
          },
        },
        ...columnKeys.map((key) => {
          return {
            field: key,
            title: key,
            dragHeader: true,
            sort: true,
            hide: hiddenColumns?.[key],
          } as ColumnDefine;
        }),
      ],
      menu: {},
      hover: {
        highlightMode: 'row',
      },
      keyboardOptions: {
        moveEditCellOnArrowKeys: true,
        copySelected: true,
        pasteValueToCell: true,
      },
      plugins: plugins.length > 0 ? plugins : [],
    }),
    [data, theme, columnKeys, hiddenColumns, plugins],
  );

  return (
    <div className="h-full select-text">
      <ListTable
        ref={tableRef}
        option={option}
        onReady={(tableInstance, isFirst) => {
          if (isFirst) {
            tableRef.current = tableInstance as ListTableAPI;
            setPlugins([contextMenuPlugin]);
          }
        }}
      />
    </div>
  );
}
