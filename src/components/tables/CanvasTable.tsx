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
import { ContextMenuPlugin, MenuClickEventArgs } from '@visactor/vtable-plugins';
import { IVTablePlugin } from '@visactor/vtable/es/plugins';
import { toast } from 'sonner';

import type { ComponentProps } from 'react';
import { CSSProperties, memo, useMemo, useRef, useState } from 'react';

import { SelectedCellType } from '@/components/views/TableView';
import { useTheme } from '@/hooks/theme-provider';
import { useResolvedColorTheme } from '@/hooks/use-color-theme';
import { i18n } from '@/i18n';
import { CopyFormat, planCopy } from '@/lib/tableClipboard';
import { OrderByType, SchemaType } from '@/stores/dataset';
import { useTableFontFamily, useTableFontSize } from '@/stores/setting';
import { isDarkTheme, isNumberType, uniqueArray } from '@/utils';

import { formatHotkey, getHotkey } from '@/hotkeys';

import { handleFieldFormat } from './format';
import { HighlightHeaderWhenSelectCellPlugin } from './highlight-header-when-select-cell';
import {
  iconCopy,
  iconCopyCsv,
  iconCopyHtml,
  iconCopyJson,
  iconCopyMarkdown,
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
  /** Header context menu: column profile (stats, distribution, filter). */
  onColumnProfile?: (columnName: string) => void;
  /** Header context menu: open pivot with this column as a row dimension. */
  onPivotColumn?: (columnName: string) => void;
  /**
   * When set, header sort uses this callback (server-side) instead of
   * VTable client-side sorting.
   */
  onOrderByColumn?: (columnName: string, options?: { desc?: boolean; clear?: boolean }) => void;
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
const MENU_COLUMN_PROFILE = msg`Column profile`;
const MENU_PIVOT_COLUMN = msg`Pivot with this column`;
const MENU_FILTER_BY_VALUE = msg`Filter by this value`;
const MENU_COPY = msg`Copy`;
const MENU_ADVANCED_COPY = msg`Advanced copy`;
const MENU_COPY_AS_CSV = msg`Copy as CSV`;
const MENU_COPY_AS_CSV_HEADER = msg`Copy as CSV with header`;
const MENU_COPY_AS_TSV = msg`Copy as TSV`;
const MENU_COPY_AS_MARKDOWN = msg`Copy as Markdown table`;
const MENU_COPY_AS_HTML = msg`Copy as HTML table`;
const MENU_COPY_AS_JSON = msg`Copy as JSON`;
const MSG_COPIED = msg`Copied`;
const MSG_COPY_FAILED = msg`Copy failed`;

/** A VTable `ContextMenuPlugin` entry: a separator (`string`) or a menu item. */
type MenuEntry = string | {
  text: string;
  menuKey: string;
  shortcut?: string;
  customIcon?: { svg: string; width?: number; height?: number };
  customClassName?: { arrow?: string | string[] };
  children?: MenuEntry[];
};

/** Join menu groups, inserting a separator between non-empty ones. */
const joinMenuGroups = (...groups: MenuEntry[][]): MenuEntry[] => {
  const out: MenuEntry[] = [];
  for (const group of groups) {
    if (!group.length) continue;
    if (out.length) out.push('---');
    out.push(...group);
  }
  return out;
};

/**
 * Every "copy as …" format, grouped under a single submenu so the first level of
 * the cell context menu stays short.
 */
const copyAsMenuChildren = (): MenuEntry[] => [
  {
    text: i18n._(MENU_COPY_AS_CSV),
    menuKey: 'copy-as-csv',
    customIcon: iconCopyCsv,
  },
  {
    text: i18n._(MENU_COPY_AS_CSV_HEADER),
    menuKey: 'copy-as-csv-header',
    customIcon: iconCopyCsv,
  },
  {
    text: i18n._(MENU_COPY_AS_TSV),
    menuKey: 'copy-as-tsv',
    customIcon: iconCopyCsv,
  },
  {
    text: i18n._(MENU_COPY_AS_MARKDOWN),
    menuKey: 'copy-as-markdown',
    customIcon: iconCopyMarkdown,
  },
  {
    text: i18n._(MENU_COPY_AS_HTML),
    menuKey: 'copy-as-html',
    customIcon: iconCopyHtml,
  },
  {
    text: i18n._(MENU_COPY_AS_JSON),
    menuKey: 'copy-as-json',
    customIcon: iconCopyJson,
  },
];

/**
 * The submenu entry holding `copyAsMenuChildren`. The parent carries no
 * `copy-as-` key prefix because parent items have no click handler.
 */
const advancedCopyMenuEntry = (): MenuEntry => ({
  text: i18n._(MENU_ADVANCED_COPY),
  menuKey: 'copy-advanced',
  customIcon: iconCopy,
  customClassName: { arrow: 'vtable-submenu-arrow' },
  children: copyAsMenuChildren(),
});

/**
 * Toasting every copy would be noise; surface one only when the payload is big
 * enough that the user may wonder whether it finished.
 */
const COPY_TOAST_ROW_THRESHOLD = 2000;

/** Copy the selection in `format`, reporting failures and large payloads. */
const copySelection = async (table: ListTableAPI | null, format: CopyFormat) => {
  if (!table) {
    return;
  }
  try {
    const plan = planCopy(
      {
        transpose: table.transpose,
        cells: table.getSelectedCellInfos() ?? [],
      },
      format,
    );
    if (!plan || !plan.text) {
      return;
    }
    await writeText(plan.text);
    if (plan.rowCount >= COPY_TOAST_ROW_THRESHOLD) {
      toast.success(`${i18n._(MSG_COPIED)}: ${plan.rowCount}`);
    }
  } catch (error) {
    toast.error(
      `${i18n._(MSG_COPY_FAILED)}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

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

  const rows = cellInfos.map((row) => row.map((item) => item.dataValue).join(','));

  if (includesHeader) {
    await writeText(rows.join('\n'));
    return;
  }

  const headerRow = firstRow
    .map((cell) => (transpose ? table.getCellValue(0, cell.row) : table.getCellValue(cell.col, 0)))
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
  } else if (typeof arg.dataValue === 'number' && !Number.isFinite(arg.dataValue)) {
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
  onColumnProfile,
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
        title: isSorted ? `${name} ${orderBy?.desc ? '↓' : '↑'}` : name,
        dragHeader: true,
        hide: hiddenColumns?.[name],
        // Disable VTable client sort when server-side handler is provided.
        sort: onOrderByColumn ? false : true,
        style: (arg) => handleColumnStyle(arg, { key, dataType, type }),
        fieldFormat: (record) =>
          handleFieldFormat(record, {
            key,
            dataType,
            type,
            beautify,
            precision,
          }),
        headerStyle: isSorted ? { fontWeight: 'bold' as const } : undefined,
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
    const bodyCopyGroup: MenuEntry[] = [
      {
        text: i18n._(MENU_COPY),
        menuKey: 'copy',
        shortcut: formatHotkey(getHotkey('table.copy')),
        customIcon: iconCopy,
      },
      advancedCopyMenuEntry(),
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
      ...(onColumnProfile
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
      bodyCellMenuItems: joinMenuGroups(bodyCopyGroup, bodyFilterGroup),
      headerCellMenuItems: joinMenuGroups(
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
            const col = String(field ?? '')
              .replace(/\s*[↑↓]\s*$/, '')
              .trim();
            if (col) onOrderByColumn?.(col, { desc: false });
          } else if (menuKey === 'sort-desc') {
            const col = String(field ?? '')
              .replace(/\s*[↑↓]\s*$/, '')
              .trim();
            if (col) onOrderByColumn?.(col, { desc: true });
          } else if (menuKey === 'sort-clear') {
            const col = String(field ?? '')
              .replace(/\s*[↑↓]\s*$/, '')
              .trim();
            if (col) onOrderByColumn?.(col, { clear: true });
          } else if (menuKey === 'column-profile') {
            const col = String(field ?? '')
              .replace(/\s*[↑↓]\s*$/, '')
              .trim();
            onColumnProfile?.(col);
          } else if (menuKey === 'pivot-column') {
            const col = String(field ?? '')
              .replace(/\s*[↑↓]\s*$/, '')
              .trim();
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
        } else if (menuKey.startsWith('copy-as-')) {
          await copySelection(table, menuKey.slice('copy-as-'.length) as CopyFormat);
        } else if (menuKey == 'filter-by-value' && onDrillDown) {
          const value = table.getCellRawValue(e.colIndex, e.rowIndex);
          const define = table.getBodyColumnDefine?.(e.colIndex, e.rowIndex) as
            | { field?: string; title?: string; key?: string }
            | undefined;
          const fieldKey =
            define?.field ?? define?.key ?? define?.title ?? table.getCellValue(e.colIndex, 0);
          const colName = String(fieldKey ?? '')
            .replace(/\s*[↑↓]\s*$/, '')
            .trim();
          if (colName) onDrillDown(colName, value);
        }
      },
    });
  }, [
    setHiddenColumns,
    onColumnProfile,
    onPivotColumn,
    onOrderByColumn,
    onDrillDown,
    orderBy,
    i18n.locale,
  ]);

  const [plugins, setPlugins] = useState<IVTablePlugin[]>([highlightPlugin]);

  const option: ListTableConstructorOptions = useMemo(() => {
    return {
      records: data,
      limitMaxAutoWidth: 200,
      heightMode: 'standard',
      defaultRowHeight: 24,
      widthMode: 'autoWidth',
      resize: {
        columnResizeMode: 'header',
      },
      // Avoid subpixel container (e.g. 972.844px) vs integer canvas (973px) thrash.
      tableSizeAntiJitter: true,
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
    <div className="h-full w-full min-h-0 min-w-0 overflow-hidden select-text" style={style}>
      <ListTable
        ref={tableRef}
        style={{ width: '100%', height: '100%' }}
        option={option}
        keepColumnWidthChange={true}
        onContextMenuCell={() => {}}
        onMouseDownCell={({ col, row }) => {
          const table = tableRef.current;
          if (table) {
            const value = table.getCellRawValue(col, row);
            const record = table.getRecordByCell?.(col, row) as
              | Record<string, unknown>
              | undefined;
            onSelectedCell?.({ col, row, value, record });
          }
        }}
        onMouseEnterCell={handleMouseEnterCell}
        onDragSelectEnd={handleDragSelectEnd}
        onResizeColumnEnd={() => {}}
        onReady={(tableInstance, isFirst) => {
          if (isFirst) {
            tableRef.current = tableInstance as ListTableAPI;
            setPlugins([highlightPlugin, contextMenuPlugin]);
          }
        }}
      />
    </div>
  );
}

const CanvasTableInner = memo(CanvasTable_);

export const CanvasTable = (props: TableProps) => {
  if ((props.schema?.length ?? 0) == 0) {
    return null;
  }
  return <CanvasTableInner {...props} />;
};

export type SimpleTableProps = {
  data: unknown[];
  hiddenColumns?: Record<string, boolean>;
  setHiddenColumns?: (col: string, hidden: boolean) => void;
  /**
   * Display-only formatters by field. Records keep their raw values, so
   * sorting and the row context menu still see the underlying data.
   */
  fieldFormatters?: Record<string, (value: unknown) => unknown>;
  /** Body context menu: open the selected row as a table tab. */
  onOpenTable?: (row: Record<string, unknown>) => void;
  /**
   * Body context menu on `filterField` (or every data column when omitted):
   * filter using this row.
   */
  onFilterByValue?: (row: Record<string, unknown>) => void;
  /** When set, "Filter by this value" is shown only for this column field. */
  filterField?: string;
};

function bodyColumnField(
  table: ListTableAPI,
  col: number,
  row: number,
): string {
  const define = table.getBodyColumnDefine?.(col, row) as
    | { field?: string }
    | undefined;
  return String(define?.field ?? '');
}

export function SimpleTable({
  data,
  hiddenColumns,
  setHiddenColumns,
  fieldFormatters,
  onOpenTable,
  onFilterByValue,
  filterField,
}: SimpleTableProps) {
  const tableRef = useRef<ListTableAPI>(null);
  const onFilterByValueRef = useRef(onFilterByValue);
  onFilterByValueRef.current = onFilterByValue;
  const theme = useTableTheme();
  const [plugins, setPlugins] = useState<IVTablePlugin[]>([]);

  const columnKeys = useMemo(
    () =>
      Object.keys((data[0] as Record<string, unknown>) ?? {}).filter(
        (key) => key !== '__raw',
      ),
    [data],
  );

  const contextMenuPlugin = useMemo(() => {
    const bodyCopyGroup: MenuEntry[] = [
      {
        text: i18n._(MENU_COPY),
        menuKey: 'copy',
        shortcut: formatHotkey(getHotkey('table.copy')),
        customIcon: iconCopy,
      },
      advancedCopyMenuEntry(),
    ];
    const bodyFilterGroup: MenuEntry[] = onFilterByValue
      ? [
          {
            text: i18n._(MENU_FILTER_BY_VALUE),
            menuKey: 'filter-by-value',
            customIcon: iconFilter,
          },
        ]
      : [];
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
      bodyCellMenuItems: joinMenuGroups(bodyCopyGroup, bodyFilterGroup, bodyOpenGroup),
      headerCellMenuItems: joinMenuGroups(headerCopyGroup, headerLayoutGroup),
      beforeShowAdjustMenuItems: (menuItems, table, col, row) => {
        if (!onFilterByValue || !filterField) return menuItems;
        const field = bodyColumnField(table as ListTableAPI, col, row);
        if (field === filterField) return menuItems;
        return menuItems.filter(
          (item) =>
            typeof item === 'string' || item.menuKey !== 'filter-by-value',
        );
      },
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
        } else if (menuKey.startsWith('copy-as-')) {
          await copySelection(table, menuKey.slice('copy-as-'.length) as CopyFormat);
        } else if (menuKey === 'filter-by-value' && onFilterByValueRef.current) {
          const record = table.getRecordByCell?.(e.colIndex, e.rowIndex) as
            | Record<string, unknown>
            | undefined;
          if (record) onFilterByValueRef.current(record);
        } else if (menuKey === 'open-table' && onOpenTable) {
          const record = table.getRecordByCell?.(e.colIndex, e.rowIndex) as
            | Record<string, unknown>
            | undefined;
          if (record) onOpenTable(record);
        }
      },
    });
  }, [setHiddenColumns, onOpenTable, onFilterByValue, filterField, i18n.locale]);

  const option: ListTableConstructorOptions = useMemo(
    () => ({
      records: data,
      limitMaxAutoWidth: 200,
      heightMode: 'standard',
      defaultRowHeight: 28,
      resize: {
        columnResizeMode: 'header',
      },
      widthMode: 'autoWidth',
      tableSizeAntiJitter: true,
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
          const format = fieldFormatters?.[key];
          return {
            field: key,
            title: key,
            dragHeader: true,
            sort: true,
            hide: hiddenColumns?.[key],
            fieldFormat: format
              ? (record: Record<string, unknown>) => format(record?.[key])
              : undefined,
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
    [data, theme, columnKeys, hiddenColumns, fieldFormatters, plugins],
  );

  return (
    <div className="h-full w-full min-h-0 min-w-0 overflow-hidden select-text">
      <ListTable
        ref={tableRef}
        style={{ width: '100%', height: '100%' }}
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
