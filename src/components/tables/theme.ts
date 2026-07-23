import { ListTable } from '@visactor/react-vtable';
import { TYPES, themes } from '@visactor/vtable';
import type { ThemeTokens } from '@/themes/presets';
import { assign } from 'radash';
import { ComponentProps } from 'react';

export type ITableThemeDefine = ComponentProps<typeof ListTable>['theme'];

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h;
  const n = Number.parseInt(full.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Mix two opaque hex colors; `t` is weight of `b` in [0, 1]. */
function mixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = parseHex(a);
  const [br, bg, bb] = parseHex(b);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
}

export type MakeTableThemeOptions = {
  isDark: boolean;
  tokens: ThemeTokens;
  tableFontFamily: string;
  tableFontSize?: number;
};

export function makeTableTheme({
  isDark,
  tokens,
  tableFontFamily,
  tableFontSize = 12,
}: MakeTableThemeOptions) {
  const fontSize = tableFontSize;
  const lineHeight = tableFontSize;

  const background = tokens.background;
  const foreground = tokens.foreground;
  const border = tokens.border;
  const headerBg = tokens.muted;
  const cardBg = tokens.card;
  const accentBg = tokens.accent;
  const selectionBg = tokens.selection;
  const backgroundAlt = isDark
    ? mixHex(background, '#000000', 0.06)
    : mixHex(background, foreground, 0.03);

  const getBodyBgColor = (args: TYPES.StylePropertyFunctionArg): string => {
    const { row, table } = args;
    const index = row - table.frozenRowCount;
    return index & 1 ? backgroundAlt : background;
  };

  const colorTheme: ITableThemeDefine = isDark
    ? {
        underlayBackgroundColor: 'transparent',
        defaultStyle: {
          color: foreground,
          bgColor: cardBg,
          borderColor: border,
        },
        headerStyle: {
          color: foreground,
          bgColor: headerBg,
          select: {
            inlineRowBgColor: selectionBg,
            inlineColumnBgColor: selectionBg,
          },
        },
        bodyStyle: {
          bgColor: getBodyBgColor,
          hover: {
            cellBgColor: accentBg,
            inlineRowBgColor: accentBg,
            inlineColumnBgColor: accentBg,
          },
        },
        frameStyle: { borderColor: border },
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
          borderColor: border,
          hover: {
            cellBgColor: accentBg,
            inlineRowBgColor: accentBg,
            inlineColumnBgColor: accentBg,
          },
        },
        headerStyle: {
          color: foreground,
          select: {
            inlineRowBgColor: selectionBg,
            inlineColumnBgColor: selectionBg,
          },
        },
        bodyStyle: {
          bgColor: getBodyBgColor,
          hover: {
            cellBgColor: accentBg,
            inlineRowBgColor: accentBg,
            inlineColumnBgColor: accentBg,
          },
        },
        frameStyle: { borderColor: border },
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
