import { useTheme } from '@mui/material';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { ListColumn, ListTable, VTable } from '@visactor/react-vtable';
import {
  ListTable as ListTableAPI,
  ListTableConstructorOptions,
  themes,
} from '@visactor/vtable';
import { useAtomValue } from 'jotai';
import React, { useEffect, useRef, useState } from 'react';
import useResizeObserver from 'use-resize-observer';

import { TableProps } from '@/components/AgTable.tsx';
import { tableFontFamilyAtom } from '@/stores/setting';
import {
  debounce,
  isDarkTheme,
  isFloat,
  isNumber,
  uniqueArray,
} from '@/utils.ts';

import type { ComponentProps } from 'react';

type ITableThemeDefine = ComponentProps<typeof ListTable>['theme'];
type ListColumnProps = ComponentProps<typeof ListColumn>;

const LIGHT_THEME: ITableThemeDefine = {
  defaultStyle: {
    fontSize: 12,
    fontFamily: 'Consolas',
    borderLineWidth: 1,
    borderColor: '#f2f2f2',
    hover: {
      cellBgColor: '#9cbef4',
      inlineRowBgColor: '#9cbef4',
      inlineColumnBgColor: '#9cbef4',
    },
  },
  headerStyle: { fontSize: 12, padding: [8, 12, 6, 12] },
  bodyStyle: {
    fontSize: 12,
    fontFamily: 'Consolas',
    lineHeight: 12,
    padding: [8, 12, 6, 12],
    hover: {
      cellBgColor: '#CCE0FF',
      inlineRowBgColor: '#F3F8FF',
      inlineColumnBgColor: '#F3F8FF',
    },
  },
  frameStyle: {
    borderColor: '#d1d5da',
    borderLineWidth: 0,
    borderLineDash: [],
    cornerRadius: 0,
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    shadowColor: 'rgba(00, 24, 47, 0.06)',
  },
  selectionStyle: {
    cellBorderLineWidth: 1,
  },
};

const DARK_THEME: ITableThemeDefine = {
  underlayBackgroundColor: 'transparent',
  defaultStyle: {
    fontSize: 12,
    fontFamily: 'Consolas',
    borderLineWidth: 1,
    color: '#D3D5DA',
    bgColor: '#373b45',
    fontWeight: 500,
    lineHeight: 12,
    borderColor: '#444A54',
  },
  headerStyle: { fontSize: 12, padding: [8, 12, 6, 12], bgColor: '#2e2f32' },
  bodyStyle: {
    fontSize: 12,
    fontFamily: 'Consolas',
    lineHeight: 12,
    padding: [8, 12, 6, 12],
  },
  frameStyle: {
    borderColor: '#d1d5da',
    borderLineWidth: 0,
    borderLineDash: [],
    cornerRadius: 0,
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
  },

  selectionStyle: {
    cellBorderLineWidth: 1,
  },
};

// const lightTheme = merge([themes.ARCO, LIGHT_THEME]);
const lightTheme = themes.ARCO.extends(LIGHT_THEME);
// const darkTheme = merge([themes.DARK, DARK_THEME]);
const darkTheme = themes.DARK.extends(DARK_THEME);

type PosType = {
  x: number;
  y: number;
  row: number;
  col: number;
  content: string;
};

export const CanvasTable = React.memo(function CanvasTable({
  data,
  schema,
  beautify,
  orderBy,
  precision,
  transpose,
  style,
}: TableProps) {
  const titleMap = new Map();

  const _titles =
    schema?.map(({ name, dataType, type }, i) => {
      const style: Record<string, string> = {};
      if (isNumber(dataType)) {
        style['textAlign'] = 'right';
      }

      const item = {
        key: name,
        name,
        type: type ?? dataType,
        dataType,
        style,
      };
      titleMap.set(name, item);
      return item;
    }) ?? [];

  if (_titles && _titles.length == 0) {
    return null;
  }

  const types = new Map(_titles.map(({ key, type }) => [key, type]));

  const [leftPinnedCols, setLeftPinnedCols] = useState<string[]>([]);
  const [rightPinnedCols, setRightPinnedCols] = useState<string[]>([]);
  const { ref, height = 100 } = useResizeObserver<HTMLDivElement>();

  const tableRef = useRef<ListTableAPI>();
  const appTheme = useTheme();
  const tableFontFamily = useAtomValue(tableFontFamilyAtom);

  const theme = (isDarkTheme(appTheme) ? darkTheme : lightTheme).extends({
    bodyStyle: {
      fontFamily: tableFontFamily,
    },
    headerStyle: {
      fontFamily: tableFontFamily,
    },
  });

  const pinnedSet = new Set([...leftPinnedCols, ...rightPinnedCols]);

  const __titles = [
    ...leftPinnedCols.map((key) => titleMap.get(key)),
    ..._titles.filter(({ key }) => !pinnedSet.has(key)),
    ...rightPinnedCols.map((key) => titleMap.get(key)),
  ];

  const __columns: ListColumnProps[] = __titles.map(
    ({ key, style, name, dataType }, _) => {
      return {
        field: name,
        fieldKey: key,
        title: name,
        dragHeader: true,
        style: (arg) => {
          if (arg.value === null || arg.value === undefined) {
            return { ...style, color: 'gray' };
          }
          return style;
        },
        fieldFormat: (record) => {
          const value = record[key];
          if (value === null) {
            return '[null]';
          }
          if (beautify && isFloat(dataType) && precision) {
            try {
              return (value as number)?.toFixed(precision);
            } catch (error) {
              return value;
            }
          }
          return value;
        },
      } as ListColumnProps;
    },
  );

  // const [popup, _setPopup] = useState<Partial<PosType>>({});
  // const popupRef = useRef(popup);
  // const setPopup = (data: Partial<PosType>) => {
  //   popupRef.current = data;
  //   _setPopup(data);
  // };

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

  const handleMouseEnterCell: ComponentProps<
    typeof ListTable
  >['onMouseEnterCell'] = async (args) => {
    const table = tableRef.current;
    if (!table) {
      return;
    }

    const { col, row } = args;
    if (!table.transpose && row === 0 && !table.stateManager.menu.isShow) {
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
          placement: VTable.TYPES.Placement.bottom,
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
    const transpose = tableRef.current?.transpose;
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
        await writeText((e?.field as string) ?? '');
      }
    }
  };

  const option: ListTableConstructorOptions = {
    records: data,
    limitMaxAutoWidth: 200,
    heightMode: 'autoHeight',
    widthMode: 'autoWidth',
    showFrozenIcon: true,
    frozenColCount: 1 + leftPinnedCols.length,
    rightFrozenColCount: rightPinnedCols.length,
    theme,
    transpose,
    columns: [
      {
        field: '__index__',
        title: '',
        dragHeader: false,
        disableSelect: true,
        disableHover: true,
        disableHeaderHover: true,
        disableHeaderSelect: true,
        disableColumnResize: true,
        style: { color: '#96938f', fontSize: 10, textAlign: 'center' },
      },
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
        return [];
      },
    },
    hover: {
      disableHover: true,
      highlightMode: 'cell',
      disableHeaderHover: true,
    },
    keyboardOptions: {
      moveEditCellOnArrowKeys: true,
      copySelected: true,
      pasteValueToCell: true,
    },
  };

  return (
    <div
      ref={ref}
      className="h-full"
      style={style}
      onContextMenu={(e) => {
        e.stopPropagation();
        e.preventDefault();
      }}
    >
      <ListTable
        ref={tableRef}
        height={height - 32}
        onContextMenuCell={(arg) => {
          console.log('context', arg);
        }}
        onSelectedCell={(arg) => {
          console.log('seleted', arg);
          console.log(tableRef.current);
          console.log(tableRef.current?.stateManager.menu);
        }}
        onDropdownMenuClick={handleDropdownMenuClick}
        onMouseEnterCell={debounce(handleMouseEnterCell)}
        option={option}
      />
    </div>
  );
});
