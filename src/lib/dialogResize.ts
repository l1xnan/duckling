export type DialogRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type DialogViewport = {
  width: number;
  height: number;
};

export type ResizeDirection =
  | 'n'
  | 's'
  | 'e'
  | 'w'
  | 'ne'
  | 'nw'
  | 'se'
  | 'sw';

export type ResizeConstraints = {
  minWidth: number;
  minHeight: number;
  viewport: DialogViewport;
};

/** Gap kept between the dialog and the viewport edge. */
export const DIALOG_VIEWPORT_MARGIN = 16;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function maxWidth(viewport: DialogViewport): number {
  return Math.max(0, viewport.width - DIALOG_VIEWPORT_MARGIN * 2);
}

function maxHeight(viewport: DialogViewport): number {
  return Math.max(0, viewport.height - DIALOG_VIEWPORT_MARGIN * 2);
}

export function centerRect(
  width: number,
  height: number,
  viewport: DialogViewport,
): DialogRect {
  const w = Math.round(Math.min(width, maxWidth(viewport)));
  const h = Math.round(Math.min(height, maxHeight(viewport)));
  return {
    x: Math.round((viewport.width - w) / 2),
    y: Math.round((viewport.height - h) / 2),
    width: w,
    height: h,
  };
}

export function clampRect(
  rect: DialogRect,
  viewport: DialogViewport,
): DialogRect {
  const width = Math.round(Math.min(rect.width, maxWidth(viewport)));
  const height = Math.round(Math.min(rect.height, maxHeight(viewport)));
  const maxX = Math.max(
    DIALOG_VIEWPORT_MARGIN,
    viewport.width - DIALOG_VIEWPORT_MARGIN - width,
  );
  const maxY = Math.max(
    DIALOG_VIEWPORT_MARGIN,
    viewport.height - DIALOG_VIEWPORT_MARGIN - height,
  );
  return {
    x: Math.round(clamp(rect.x, DIALOG_VIEWPORT_MARGIN, maxX)),
    y: Math.round(clamp(rect.y, DIALOG_VIEWPORT_MARGIN, maxY)),
    width,
    height,
  };
}

export function resizeRect(
  start: DialogRect,
  direction: ResizeDirection,
  delta: { x: number; y: number },
  { minWidth, minHeight, viewport }: ResizeConstraints,
): DialogRect {
  const minLeft = DIALOG_VIEWPORT_MARGIN;
  const minTop = DIALOG_VIEWPORT_MARGIN;
  const maxRight = Math.max(minLeft, viewport.width - DIALOG_VIEWPORT_MARGIN);
  const maxBottom = Math.max(minTop, viewport.height - DIALOG_VIEWPORT_MARGIN);

  let left = start.x;
  let right = start.x + start.width;
  let top = start.y;
  let bottom = start.y + start.height;

  if (direction.includes('w')) {
    left = clamp(left + delta.x, minLeft, Math.max(minLeft, right - minWidth));
  }
  if (direction.includes('e')) {
    right = clamp(
      right + delta.x,
      Math.min(maxRight, left + minWidth),
      maxRight,
    );
  }
  if (direction.includes('n')) {
    top = clamp(top + delta.y, minTop, Math.max(minTop, bottom - minHeight));
  }
  if (direction.includes('s')) {
    bottom = clamp(
      bottom + delta.y,
      Math.min(maxBottom, top + minHeight),
      maxBottom,
    );
  }

  return {
    x: Math.round(left),
    y: Math.round(top),
    width: Math.round(right - left),
    height: Math.round(bottom - top),
  };
}
