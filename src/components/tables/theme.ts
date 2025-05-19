import { ListTable } from '@visactor/react-vtable';
import { TYPES, themes } from '@visactor/vtable';
import { assign } from 'radash';
import { ComponentProps } from 'react';
export type ITableThemeDefine = ComponentProps<typeof ListTable>['theme'];

export const LIGHT_THEME: ITableThemeDefine = {
  defaultStyle: {
    borderColor: '#f2f2f2',
    hover: {
      cellBgColor: '#9cbef4',
      inlineRowBgColor: '#9cbef4',
      inlineColumnBgColor: '#9cbef4',
    },
  },
  headerStyle: {
    color: '#000',
    select: {
      inlineRowBgColor: 'rgb(210, 210, 252)',
      inlineColumnBgColor: 'rgb(210, 210, 252)',
    },
  },
  bodyStyle: {
    bgColor: getLightBackgroundColor,
    hover: {
      cellBgColor: '#CCE0FF',
      inlineRowBgColor: '#F3F8FF',
      inlineColumnBgColor: '#F3F8FF',
    },
  },
  frameStyle: {
    borderColor: '#d1d5da',
  },
  frozenColumnLine: {
    shadow: {
      width: 1,
      startColor: 'rgba(00, 24, 47, 0.05)',
      endColor: 'rgba(00, 24, 47, 0)',
      visible: 'scrolling',
    },
  },
};

export const DARK_THEME: ITableThemeDefine = {
  underlayBackgroundColor: 'transparent',
  defaultStyle: {
    color: '#D3D5DA',
    bgColor: '#373b45',
    borderColor: '#444A54',
  },
  headerStyle: {
    color: '#fff',
    bgColor: '#2e2f32',
    select: {
      inlineRowBgColor: 'rgb(81, 81, 99)',
      inlineColumnBgColor: 'rgb(81, 81, 99)',
    },
  },
  bodyStyle: {
    bgColor: getDarkBackgroundColor,
  },
  frameStyle: {
    borderColor: '#454a54',
  },
  frozenColumnLine: {
    shadow: {
      width: 4,
      startColor: 'rgba(00, 24, 47, 0.05)',
      endColor: 'rgba(00, 24, 47, 0)',
      visible: 'scrolling',
    },
  },
};

function getDarkBackgroundColor(args: TYPES.StylePropertyFunctionArg): string {
  const { row, table } = args;
  const index = row - table.frozenRowCount;

  if (!(index & 1)) {
    return '#2d3137';
  }
  return '#282a2e';
}

function getLightBackgroundColor(args: TYPES.StylePropertyFunctionArg): string {
  const { row, table } = args;
  const index = row - table.frozenRowCount;

  if (!(index & 1)) {
    return '#FFF';
  }
  return '#fbfbfc';
}

export function makeTableTheme(isDark: boolean, tableFontFamily: string) {
  const common: ITableThemeDefine = {
    cellInnerBorder: false,
    defaultStyle: {
      fontSize: 12,
      fontFamily: 'Consolas',
      borderLineWidth: 1,
      fontWeight: 500,
      lineHeight: 12,
    },
    bodyStyle: {
      fontSize: 12,
      lineHeight: 12,
      padding: [8, 12, 6, 12],
      fontFamily: tableFontFamily,
      borderLineWidth: 1,
    },
    headerStyle: {
      fontFamily: tableFontFamily,
      fontSize: 12,
      padding: [8, 12, 6, 12],
      borderLineWidth: 1,
    },
    frameStyle: {
      borderLineWidth: [0, 1, 1, 0],
      borderLineDash: [],
      cornerRadius: 0,
      shadowBlur: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
    },
    scrollStyle: {
      width: 10,
      visible: 'always',
      scrollSliderCornerRadius: 0,
      hoverOn: false,
      barToSide: true,
    },
    selectionStyle: {
      cellBorderLineWidth: 1,
    },
    frozenColumnLine: {
      shadow: {
        width: 4,
        startColor: 'rgba(00, 24, 47, 0.05)',
        endColor: 'rgba(00, 24, 47, 0)',
        visible: 'scrolling',
      },
    },
  };

  const [baseTheme, colorTheme] = isDark
    ? [themes.DARK, DARK_THEME]
    : [themes.ARCO, LIGHT_THEME];
  return baseTheme.extends(assign(common, colorTheme as object));
}
