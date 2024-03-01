import { useTheme } from '@mui/material';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import {
  ListColumn,
  ListTable,
  VTable,
  type IVTable,
} from '@visactor/react-vtable';
import { themes } from '@visactor/vtable';
import { ListTable as ListTableAPI } from '@visactor/vtable/ListTable';
import { useAtomValue } from 'jotai';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import useResizeObserver from 'use-resize-observer';

import { TableProps } from '@/components/AgTable.tsx';
import { tableFontFamilyAtom } from '@/stores/setting';
import { debounce, isDarkTheme, isFloat, isNumber } from '@/utils.ts';

type ITableThemeDefine = ComponentProps<typeof ListTable>['theme'];

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

export function CanvasTable({
  data,
  titles,
  schema,
  beautify,
  orderBy,
  precision,
  transpose,
  style,
  ...rest
}: TableProps) {
  const titleMap = new Map();

  const _titles =
    schema?.map(({ name, dataType }, i) => {
      const title = titles?.[i];
      const style: Record<string, string> = {};
      if (isNumber(dataType)) {
        style['textAlign'] = 'right';
      }

      const item = {
        key: name,
        name,
        type: title?.type ?? dataType,
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

  const tableRef = useRef<IVTable & ListTableAPI>();
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

  const __titles = [
    ...leftPinnedCols.map((key) => titleMap.get(key)),
    ..._titles.filter(
      ({ key }) =>
        !leftPinnedCols.includes(key) && !rightPinnedCols.includes(key),
    ),
    ...rightPinnedCols.map((key) => titleMap.get(key)),
  ];
  console.log(__titles);

  const columns = __titles.map(({ key, style, name, dataType }, _) => {
    return (
      <ListColumn
        field={name}
        fieldKey={key}
        title={name}
        dragHeader={true}
        style={(arg) => {
          if (arg.value === null) {
            return { ...style, color: 'gray' };
          }
          return style;
        }}
        fieldFormat={(record) => {
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
        }}
      />
    );
  });

  const handleMouseEnterCell: ComponentProps<
    typeof ListTable
  >['onMouseEnterCell'] = async (args) => {
    const tableInstance = tableRef.current;
    if (tableInstance === null) {
      return;
    }

    const { col, row } = args;

    if (!tableInstance.transpose && row === 0) {
      const rect = tableInstance.getVisibleCellRangeRelativeRect({
        col,
        row,
      });

      const name = tableInstance.getCellValue(col, row);
      const type = types.get(name);
      tableInstance.showTooltip(col, row, {
        content: `${name}: ${type}`,
        referencePosition: {
          rect,
          placement: VTable.TYPES.Placement.bottom,
        },
        className: 'defineTooltip',
        style: {
          bgColor: 'black',
          color: 'white',
          font: 'normal bold normal 12px/1',
          arrowMark: true,
        },
      });
    }
  };

  useEffect(() => {
    const handleBodyClick = (_e: Event) => {
      const tableInstance: ListTableAPI = tableRef.current;
      if (tableInstance === null) {
        return;
      }
      tableInstance.stateManager.hideMenu();
    };

    document.body.addEventListener('click', handleBodyClick);
    document.body.addEventListener('dblclick', handleBodyClick);
    document.body.addEventListener('contextmenu', handleBodyClick);

    return () => {
      document.body.removeEventListener('click', handleBodyClick);
      document.body.removeEventListener('dblclick', handleBodyClick);
      document.body.removeEventListener('contextmenu', handleBodyClick);
    };
  }, []);
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
        records={data}
        limitMaxAutoWidth={200}
        heightMode="autoHeight"
        widthMode="autoWidth"
        showFrozenIcon={true}
        frozenColCount={1 + leftPinnedCols.length}
        rightFrozenColCount={rightPinnedCols.length}
        dragHeaderMode="column"
        transpose={transpose}
        theme={theme}
        menu={{
          contextMenuItems: (field, row, col) => {
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
              ];
            }
            return [];
          },
        }}
        hover={{
          disableHover: true,
          highlightMode: 'cell',
          disableHeaderHover: true,
        }}
        keyboardOptions={{
          moveEditCellOnArrowKeys: true,
          copySelected: true,
          pasteValueToCell: true,
        }}
        onContextMenuCell={(arg) => {
          console.log('context', arg);
        }}
        onSelectedCell={(arg) => {
          console.log('selected', arg);
        }}
        onDropdownMenuClick={async (e) => {
          if (e.row == 0) {
            if (e.menuKey == 'copy-field') {
              console.log('clip', e?.field);
              await writeText((e?.field as string) ?? '');
            } else if (e.menuKey == 'pin-to-left') {
              setLeftPinnedCols((v) => [...v, e.field as string]);
            } else if (e.menuKey == 'pin-to-right') {
              setRightPinnedCols((v) => [e.field as string, ...v]);
            }
          } else {
            if (e.menuKey == 'copy') {
              await writeText((e?.field as string) ?? '');
            }
          }
        }}
        onMouseEnterCell={debounce(handleMouseEnterCell)}
      >
        <ListColumn
          field="__index__"
          title=""
          dragHeader={false}
          disableSelect={true}
          disableHover={true}
          disableHeaderHover={true}
          disableHeaderSelect={true}
          disableColumnResize={true}
          style={{ color: '#96938f', fontSize: 10, textAlign: 'center' }}
        />
        {columns}
      </ListTable>
    </div>
  );
}
