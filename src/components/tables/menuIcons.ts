/**
 * Lucide-style SVG icons for VTable ContextMenuPlugin (`customIcon`).
 * 14×14, currentColor stroke — matches app UI density.
 */

const SIZE = 14;

export type MenuSvgIcon = {
  svg: string;
  width?: number;
  height?: number;
};

function lucideSvg(paths: string): MenuSvgIcon {
  return {
    width: SIZE,
    height: SIZE,
    svg:
      `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" ` +
      `viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ` +
      `stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`,
  };
}

/** Copy (two overlapping rectangles). */
export const iconCopy = lucideSvg(
  '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>' +
    '<path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
);

/** FileSpreadsheet — copy as CSV. */
export const iconCopyCsv = lucideSvg(
  '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>' +
    '<path d="M14 2v4a2 2 0 0 0 2 2h4"/>' +
    '<path d="M8 13h2"/><path d="M14 13h2"/><path d="M8 17h2"/><path d="M14 17h2"/>',
);

/** ArrowUpNarrowWide — sort ascending. */
export const iconSortAsc = lucideSvg(
  '<path d="m3 8 4-4 4 4"/><path d="M7 4v16"/>' +
    '<path d="M11 12h4"/><path d="M11 16h7"/><path d="M11 20h10"/>',
);

/** ArrowDownNarrowWide — sort descending. */
export const iconSortDesc = lucideSvg(
  '<path d="m3 16 4 4 4-4"/><path d="M7 20V4"/>' +
    '<path d="M11 4h10"/><path d="M11 8h7"/><path d="M11 12h4"/>',
);

/** ListRestart / X — clear sort. */
export const iconSortClear = lucideSvg(
  '<path d="M21 6H3"/><path d="M7 12H3"/><path d="M7 18H3"/>' +
    '<path d="m15 9 6 6"/><path d="m21 9-6 6"/>',
);

/** ChartColumn — count by column. */
export const iconCountBy = lucideSvg(
  '<path d="M3 3v16a2 2 0 0 0 2 2h16"/>' +
    '<path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
);

/** ScanSearch — column profile. */
export const iconProfile = lucideSvg(
  '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/>' +
    '<path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>' +
    '<circle cx="12" cy="12" r="3"/><path d="m16 16-1.9-1.9"/>',
);

/** PanelLeft — pin to left. */
export const iconPinLeft = lucideSvg(
  '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/>',
);

/** PinOff — clear pin. */
export const iconPinClear = lucideSvg(
  '<path d="M12 17v5"/>' +
    '<path d="M15 9.34V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H7.89"/>' +
    '<path d="m2 2 20 20"/>' +
    '<path d="M9 9v1.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h11"/>',
);

/** PanelRight — pin to right. */
export const iconPinRight = lucideSvg(
  '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/>',
);

/** EyeOff — hide column. */
export const iconHide = lucideSvg(
  '<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/>' +
    '<path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/>' +
    '<path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-4.76"/>' +
    '<path d="m2 2 20 20"/>',
);

/** Filter — filter by cell value. */
export const iconFilter = lucideSvg(
  '<path d="M22 3H2l8 9.46V19l4 2v-8.54z"/>',
);

/** Type / text cursor — copy field name. */
export const iconField = lucideSvg(
  '<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" x2="15" y1="20" y2="20"/>' +
    '<line x1="12" x2="12" y1="4" y2="20"/>',
);
