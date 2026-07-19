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
import { FieldDef } from '@visactor/vtable/es/ts-types';
import dayjs from 'dayjs';

import type { ComponentProps } from 'react';
import { CSSProperties, useMemo, useRef, useState } from 'react';

import { SelectedCellType } from '@/components/views/TableView';
import { useTheme } from '@/hooks/theme-provider';
import { i18n } from '@/i18n';
import { OrderByType, SchemaType } from '@/stores/dataset';
import { useTableFontFamily, useTableFontSize } from '@/stores/setting';
import { isDarkTheme, isNumberType, uniqueArray } from '@/utils';

import { handleFieldFormat } from './format';
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
  const tableFontFamily = useTableFontFamily();
  const tableFontSize = useTableFontSize();
  return useMemo(
    () => makeTableTheme(isDark, tableFontFamily, tableFontSize),
    [isDark, tableFontFamily, tableFontSize],
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

const MENU_COPY_FIELD = msg`Copy Field Name`;
const MENU_PIN_LEFT = msg`Pin to left`;
const MENU_PIN_RIGHT = msg`Pin to right`;
const MENU_PIN_CLEAR = msg`Clear pinned`;
const MENU_HIDDEN_COLUMN = msg`Hidden column`;
const MENU_COPY = msg`Copy`;
const MENU_COPY_AS_CSV = msg`Copy as CSV`;

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
        text: i18n._(MENU_COPY_FIELD),
      },
      {
        menuKey: 'pin-to-left',
        text: i18n._(MENU_PIN_LEFT),
      },
      {
        menuKey: 'pin-to-right',
        text: i18n._(MENU_PIN_RIGHT),
      },
      {
        menuKey: 'pin-to-clear',
        text: i18n._(MENU_PIN_CLEAR),
      },
      {
        menuKey: 'hidden-column',
        text: i18n._(MENU_HIDDEN_COLUMN),
      },
    ];
  }
  return [
    {
      menuKey: 'copy',
      text: i18n._(MENU_COPY),
    },
    {
      menuKey: 'copy-as-csv',
      text: i18n._(MENU_COPY_AS_CSV),
    },
  ];
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

const _handleFieldFormat = (
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

  const templ = 'YYYY-MM-DD HH:mm:ss';
  if (DataType.isDate(dataType) && type?.toLowerCase()?.includes('datetime')) {
    return dayjs(value).format(templ);
  } else if (DataType.isDate(dataType)) {
    return dayjs(value).format('YYYY-MM-DD');
  } else if (DataType.isTimestamp(dataType)) {
    if (!dataType.timezone) {
      return dayjs(value).utc().format(templ);
    }
    return dayjs(value).format(templ);
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

function CanvasTable_({
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
        await copySelectedAsCsv(table);
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
        colHighlightBGColor: isDark ? '#9cbef4' : '#CCE0FF',
        colHighlightColor: '#1f2937',
        rowHighlightBGColor: isDark ? '#9cbef4' : '#CCE0FF',
        rowHighlightColor: '#1f2937',
      }),
    [isDark],
  );

  const contextMenuPlugin = useMemo(() => {
    return new ContextMenuPlugin({
      bodyCellMenuItems: [
        {
          text: i18n._(MENU_COPY),
          menuKey: 'copy',
          shortcut: 'Ctrl+C',
        },
        {
          text: i18n._(MENU_COPY_AS_CSV),
          menuKey: 'copy-as-csv',
        },
      ],
      headerCellMenuItems: [
        {
          menuKey: 'copy-field',
          text: i18n._(MENU_COPY_FIELD),
        },
        {
          menuKey: 'pin-to-left',
          text: i18n._(MENU_PIN_LEFT),
        },
        {
          menuKey: 'pin-to-right',
          text: i18n._(MENU_PIN_RIGHT),
        },
        {
          menuKey: 'pin-to-clear',
          text: i18n._(MENU_PIN_CLEAR),
        },
        {
          menuKey: 'hidden_column',
          text: i18n._(MENU_HIDDEN_COLUMN),
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
          await copySelectedAsCsv(table);
        }
      },
    });
  }, [setHiddenColumns, i18n.locale]);

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
}

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
          disableHover: true,
          style: { color: '#838383', fontSize: 10, textAlign: 'center' },
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
