import { useTheme } from '@mui/material';
import { ListColumn, ListTable } from '@visactor/react-vtable';
import { themes } from '@visactor/vtable';
import useResizeObserver from 'use-resize-observer';

import { TableProps } from '@/components/AgTable.tsx';
import { isDarkTheme } from '@/utils.ts';

import type { ComponentProps } from 'react';

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
  ...rest
}: TableProps) {
  if (titles.length == 0) {
    return null;
  }

  const { ref, height = 100 } = useResizeObserver<HTMLDivElement>();
  const columns =
    titles?.map((col, i) => {
      return <ListColumn field={col.name} title={col.name} dragHeader={true} />;
    }) ?? [];

  const appTheme = useTheme();

  const theme = isDarkTheme(appTheme) ? darkTheme : lightTheme;

  const transpose = false;
  return (
    <div ref={ref} className="h-full">
      <ListTable
        height={height - 32}
        records={data}
        heightMode="autoHeight"
        widthMode="autoWidth"
        showFrozenIcon={true}
        frozenColCount={1}
        dragHeaderMode="column"
        transpose={transpose}
        menu={{
          contextMenuItems: ['Copy Cell', 'Copy Column'],
        }}
        hover={{
          highlightMode: 'cross',
        }}
        keyboardOptions={{
          moveEditCellOnArrowKeys: true,
          copySelected: true,
          pasteValueToCell: true,
        }}
        theme={theme}
      >
        <ListColumn
          field="__index__"
          title="#"
          dragHeader={false}
          disableSelect={true}
          disableHover={true}
          disableHeaderHover={true}
          disableHeaderSelect={true}
          disableColumnResize={true}
        />
        {columns}
      </ListTable>
    </div>
  );
}
