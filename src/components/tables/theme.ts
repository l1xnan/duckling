import { ListTable } from '@visactor/react-vtable';
import { TYPES, themes } from '@visactor/vtable';
import { assign } from 'radash';
import { ComponentProps } from 'react';
export type ITableThemeDefine = ComponentProps<typeof ListTable>['theme'];

/**
 * Color palette derived directly from isDark flag.
 * These MUST stay in sync with globals.css values.
 */
const LIGHT_COLORS = {
  background: '#ffffff',
  backgroundAlt: '#fbfbfc',
  foreground: '#0d0f12',          // hsl(220 10% 4%)
  border: '#e2e5ea',              // hsl(220 13% 91%)
  headerBg: '#f4f5f7',            // hsl(220 14% 96%)
  cardBg: '#ffffff',
  accentBg: '#fff7d6',            // hsl(48 100% 94%)
  selectionBg: '#fff0c2',         // hsl(48 100% 88%)
};

const DARK_COLORS = {
  background: '#171b21',          // hsl(220 10% 10%)
  backgroundAlt: '#14171d',       // -1 lightness
  foreground: '#f2f2f2',          // hsl(0 0% 95%)
  border: '#3b414a',              // hsl(220 10% 22%)
  headerBg: '#282d36',            // hsl(220 10% 17%)
  cardBg: '#24282f',              // hsl(220 10% 14%)
  accentBg: '#3d3520',            // hsl(48 50% 18%)
  selectionBg: '#4a3f1f',         // hsl(48 80% 30%)
};

export function makeTableTheme(
  isDark: boolean,
  tableFontFamily: string,
  tableFontSize = 12,
) {
  const fontSize = tableFontSize;
  const lineHeight = tableFontSize;
  const c = isDark ? DARK_COLORS : LIGHT_COLORS;

  const getBodyBgColor = (args: TYPES.StylePropertyFunctionArg): string => {
    const { row, table } = args;
    const index = row - table.frozenRowCount;
    return (index & 1) ? c.backgroundAlt : c.background;
  };

  const colorTheme: ITableThemeDefine = isDark
    ? {
        underlayBackgroundColor: 'transparent',
        defaultStyle: {
          color: c.foreground,
          bgColor: c.cardBg,
          borderColor: c.border,
        },
        headerStyle: {
          color: c.foreground,
          bgColor: c.headerBg,
          select: {
            inlineRowBgColor: c.selectionBg,
            inlineColumnBgColor: c.selectionBg,
          },
        },
        bodyStyle: {
          bgColor: getBodyBgColor,
          hover: {
            cellBgColor: c.accentBg,
            inlineRowBgColor: c.accentBg,
            inlineColumnBgColor: c.accentBg,
          },
        },
        frameStyle: { borderColor: c.border },
        frozenColumnLine: {
          shadow: {
            width: 4,
            startColor: 'rgba(00, 24, 47, 0.05)',
            endColor: 'rgba(00, 24, 47, 0)',
            visible: 'scrolling',
          },
        },
      }
    : {
        defaultStyle: {
          borderColor: c.border,
          hover: {
            cellBgColor: c.accentBg,
            inlineRowBgColor: c.accentBg,
            inlineColumnBgColor: c.accentBg,
          },
        },
        headerStyle: {
          color: c.foreground,
          select: {
            inlineRowBgColor: c.selectionBg,
            inlineColumnBgColor: c.selectionBg,
          },
        },
        bodyStyle: {
          bgColor: getBodyBgColor,
          hover: {
            cellBgColor: c.accentBg,
            inlineRowBgColor: c.accentBg,
            inlineColumnBgColor: c.accentBg,
          },
        },
        frameStyle: { borderColor: c.border },
        frozenColumnLine: {
          shadow: {
            width: 1,
            startColor: 'rgba(00, 24, 47, 0.05)',
            endColor: 'rgba(00, 24, 47, 0)',
            visible: 'scrolling',
          },
        },
      };

  const common: ITableThemeDefine = {
    cellInnerBorder: false,
    defaultStyle: {
      fontSize,
      fontFamily: 'Consolas',
      borderLineWidth: 1,
      fontWeight: 500,
      lineHeight,
    },
    bodyStyle: {
      fontSize,
      lineHeight,
      padding: [8, 12, 6, 12],
      fontFamily: tableFontFamily,
      borderLineWidth: 1,
    },
    headerStyle: {
      fontFamily: tableFontFamily,
      fontSize,
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

  const [baseTheme] = isDark ? [themes.DARK] : [themes.ARCO];
  return baseTheme.extends(assign(common, colorTheme as object));
}
