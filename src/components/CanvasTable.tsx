import { useTheme } from '@mui/material';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { ListColumn, ListTable } from '@visactor/react-vtable';
import { themes } from '@visactor/vtable';
import { useState, type ComponentProps } from 'react';
import useResizeObserver from 'use-resize-observer';

import { TableProps } from '@/components/AgTable.tsx';
import { isDarkTheme } from '@/utils.ts';

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
  headerStyle: {
    fontSize: 12,
  },
  bodyStyle: {
    fontSize: 12,
    lineHeight: 12,
    padding: [8, 12, 8, 12],
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
  frameStyle: {
    borderColor: '#d1d5da',
    borderLineWidth: 0,
    borderLineDash: [],
    cornerRadius: 0,
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
  },
  headerStyle: {
    bgColor: '#2e2f32',
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
  transpose = false,
  ...rest
}: TableProps) {
  if (titles.length == 0) {
    return null;
  }
  const [leftPinnedCols, setLeftPinnedCols] = useState<string[]>([]);
  const [rightPinnedCols, setRightPinnedCols] = useState<string[]>([]);
  const { ref, height = 100 } = useResizeObserver<HTMLDivElement>();

  console.log(leftPinnedCols);

  const leftPinned = leftPinnedCols.map((name) => {
    return <ListColumn field={name} title={name} dragHeader={true} />;
  });
  const rightPinned = rightPinnedCols.map((name) => {
    return <ListColumn field={name} title={name} dragHeader={true} />;
  });

  const columns =
    titles
      ?.filter(
        (col) =>
          !leftPinnedCols.includes(col.name) &&
          !rightPinnedCols.includes(col.name),
      )
      ?.map((col, i) => {
        return (
          <ListColumn field={col.name} title={col.name} dragHeader={true} />
        );
      }) ?? [];

  const appTheme = useTheme();

  const theme = isDarkTheme(appTheme) ? darkTheme : lightTheme;

  return (
    <div ref={ref} className="h-full">
      <ListTable
        height={height - 32}
        records={data}
        heightMode="autoHeight"
        widthMode="autoWidth"
        showFrozenIcon={true}
        frozenColCount={1 + leftPinnedCols.length}
        rightFrozenColCount={rightPinnedCols.length}
        dragHeaderMode="column"
        transpose={transpose}
        menu={{
          contextMenuItems: (_, row) => {
            if (row == 0) {
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
          highlightMode: 'cell',
          disableHeaderHover: true,
        }}
        keyboardOptions={{
          moveEditCellOnArrowKeys: true,
          copySelected: true,
          pasteValueToCell: true,
        }}
        theme={theme}
        onContextMenuCell={(...args) => {
          console.log('context', args);
        }}
        onSelectedCell={(...args) => {
          console.log('selected', args);
        }}
        onDropdownMenuClick={async (e, ...args) => {
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

          console.log('onDropdownMenuClick', e, args);
        }}
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
        {leftPinned}
        {columns}
        {rightPinned}
      </ListTable>
    </div>
  );
}
