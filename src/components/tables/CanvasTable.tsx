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
import {
  CSSProperties,
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { OrderByType, SchemaType } from '@/stores/dataset';
import { downloadCsv, exportVTableToCsv } from '@visactor/vtable-export';
import dayjs from 'dayjs';
import type { ComponentProps } from 'react';

import { SelectedCellType } from '@/components/views/TableView';
import { useTheme } from '@/hooks/theme-provider';
import { tableFontFamilyAtom } from '@/stores/setting';
import { isDarkTheme, isNumberType, uniqueArray } from '@/utils';
import { makeTableTheme } from './theme';

export interface TableProps<T = unknown> {
  data: T[];
  schema: SchemaType[];
  beautify?: boolean;
  precision?: number;
  style?: CSSProperties;
  orderBy?: OrderByType;
  transpose?: boolean;
  cross?: boolean;
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

const CanvasTable_ = memo(function CanvasTable({
  data,
  schema,
  beautify,
  precision,
  transpose,
  cross,
  style,
  onSelectedCell,
  onSelectedCellInfos,
}: TableProps) {
  const tableRef = useRef<ListTableAPI>(null);

  const [leftPinnedCols, setLeftPinnedCols] = useState<string[]>([]);
  const [rightPinnedCols, setRightPinnedCols] = useState<string[]>([]);

  useEffect(() => {
    const handleBodyClick = (_e: Event) => {
      tableRef.current?.stateManager.hideMenu();
    };

    document.addEventListener('click', handleBodyClick);
    document.addEventListener('dblclick', handleBodyClick);
    document.addEventListener('contextmenu', handleBodyClick);
    // document.addEventListener('mousedown', handleBodyClick);

    return () => {
      document.removeEventListener('click', handleBodyClick);
      document.removeEventListener('dblclick', handleBodyClick);
      document.removeEventListener('contextmenu', handleBodyClick);
      // document.removeEventListener('mousedown', handleBodyClick);
    };
  }, []);

  const _titles = useMemo(
    () =>
      schema.map(({ name, dataType, type }) => {
        return {
          key: name,
          name,
          type: type ?? dataType.toString(),
          dataType,
        };
      }),
    [schema],
  );

  const [titleMap, types] = useMemo(
    () => [
      new Map(_titles.map((item) => [item.name, item])),
      new Map(_titles.map(({ key, type }) => [key, type])),
    ],
    [_titles],
  );

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
        sort: true,
        style: (arg) => {
          const style: Record<string, string> = {};
          if (
            isNumberType(dataType) ||
            type?.toLowerCase()?.includes('decimal')
          ) {
            style['textAlign'] = 'right';
          }
          if (arg.dataValue === null || arg.dataValue === undefined) {
            style['color'] = 'gray';
          }
          return style;
        },
        fieldFormat: (record) => {
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
          if (
            DataType.isDate(dataType) &&
            type?.toLowerCase()?.includes('datetime')
          ) {
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
        },
      } as ColumnDefine;
    });
  }, [leftPinnedCols, rightPinnedCols, _titles, titleMap, beautify, precision]);

  const exportToCsv = (name: string) => {
    // TODO: test
    const table = tableRef.current;
    if (table) {
      const csv = exportVTableToCsv(table);
      downloadCsv(csv, name);
    }
  };

  const handleMouseEnterCell: ComponentProps<
    typeof ListTable
  >['onMouseEnterCell'] = (args) => {
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
  const handleDropdownMenuClick: ComponentProps<
    typeof ListTable
  >['onDropdownMenuClick'] = async (e) => {
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

  const handleDragSelectEnd: ComponentProps<
    typeof ListTable
  >['onDragSelectEnd'] = (e) => {
    onSelectedCellInfos?.(e.cells as SelectedCellType[][]);
  };
  const theme = useTableTheme();

  const option: ListTableConstructorOptions = useMemo(() => {
    return {
      records: data,
      limitMaxAutoWidth: 200,
      heightMode: 'standard',
      defaultRowHeight: 24,
      widthMode: 'autoWidth',
      showFrozenIcon: true,
      frozenColCount: transpose ? 1 : 1 + leftPinnedCols.length,
      rightFrozenColCount: rightPinnedCols.length,
      frozenRowCount: 0,
      theme,
      transpose,
      rowSeriesNumber: !transpose
        ? {
            title: '',
            width: 'auto',
            headerStyle: {},
            style: { color: '#96938f', fontSize: 10, textAlign: 'center' },
            dragOrder: false,
            disableColumnResize: true,
          }
        : undefined,
      columns: [
        // {
        //   field: '__index__',
        //   title: '',
        //   dragHeader: false,
        //   disableSelect: true,
        //   // disableHover: true,
        //   disableHeaderHover: true,
        //   disableHeaderSelect: true,
        //   disableColumnResize: true,
        //   style: { color: '#96938f', fontSize: 10, textAlign: 'center' },
        //   fieldFormat: (_r, col, row) => {
        //     return transpose ? col : row;
        //   },
        // },
        ...__columns,
      ],
      menu: {
        contextMenuItems: (_field, row, col) => {
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
        },
      },
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
    };
  }, [
    data,
    transpose,
    leftPinnedCols.length,
    rightPinnedCols.length,
    theme,
    __columns,
    cross,
  ]);
  return (
    <div
      className="h-full select-text"
      style={style}
      onContextMenu={(e) => {
        e.stopPropagation();
        e.preventDefault();
      }}
    >
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
        onDropdownMenuClick={handleDropdownMenuClick}
        onMouseEnterCell={handleMouseEnterCell}
        onDragSelectEnd={handleDragSelectEnd}
        onResizeColumnEnd={() => {
          const widths = tableRef.current?.colWidthsMap;
          console.log('new widths', widths);
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
    }),
    [data],
  );

  return (
    <div className="h-full">
      <ListTable ref={tableRef} option={option} />
    </div>
  );
}
