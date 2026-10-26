import { describe, expect, it } from 'vitest';

import {
  DIALOG_VIEWPORT_MARGIN,
  centerRect,
  clampRect,
  resizeRect,
  type DialogRect,
  type ResizeDirection,
} from '@/lib/dialogResize';

const viewport = { width: 1440, height: 900 };
const constraints = { minWidth: 480, minHeight: 360, viewport };
const start: DialogRect = { x: 240, y: 170, width: 960, height: 560 };

function drag(direction: ResizeDirection, x: number, y: number): DialogRect {
  return resizeRect(start, direction, { x, y }, constraints);
}

describe('centerRect', () => {
  it('centers the dialog in the viewport', () => {
    expect(centerRect(960, 720, viewport)).toEqual({
      x: 240,
      y: 90,
      width: 960,
      height: 720,
    });
  });

  it('caps the default size to the viewport margin', () => {
    expect(centerRect(1600, 1000, { width: 1280, height: 720 })).toEqual({
      x: DIALOG_VIEWPORT_MARGIN,
      y: DIALOG_VIEWPORT_MARGIN,
      width: 1248,
      height: 688,
    });
  });
});

describe('resizeRect edges', () => {
  it('widens from the east edge without moving the left edge', () => {
    expect(drag('e', 100, 0)).toEqual({
      x: 240,
      y: 170,
      width: 1060,
      height: 560,
    });
  });

  it('widens to the west while the right edge stays put', () => {
    const next = drag('w', 100, 0);
    expect(next).toEqual({ x: 340, y: 170, width: 860, height: 560 });
    expect(next.x + next.width).toBe(start.x + start.width);
  });

  it('grows upward from the north edge', () => {
    expect(drag('n', 0, 50)).toEqual({
      x: 240,
      y: 220,
      width: 960,
      height: 510,
    });
  });

  it('grows downward from the south edge', () => {
    expect(drag('s', 0, 100)).toEqual({
      x: 240,
      y: 170,
      width: 960,
      height: 660,
    });
  });
});

describe('resizeRect corners', () => {
  it('moves both axes from the south-east corner', () => {
    expect(drag('se', 200, 100)).toEqual({
      x: 240,
      y: 170,
      width: 1160,
      height: 660,
    });
  });

  it('moves both axes from the north-west corner', () => {
    expect(drag('nw', -40, -30)).toEqual({
      x: 200,
      y: 140,
      width: 1000,
      height: 590,
    });
  });
});

describe('resizeRect minimum size', () => {
  it('stops the west edge at the minimum width', () => {
    expect(drag('w', 1000, 0)).toEqual({
      x: 720,
      y: 170,
      width: 480,
      height: 560,
    });
  });

  it('stops the east edge at the minimum width', () => {
    expect(drag('e', -1000, 0)).toEqual({
      x: 240,
      y: 170,
      width: 480,
      height: 560,
    });
  });

  it('stops the north edge at the minimum height', () => {
    expect(drag('n', 0, 1000)).toEqual({
      x: 240,
      y: 370,
      width: 960,
      height: 360,
    });
  });

  it('stops the south edge at the minimum height', () => {
    expect(drag('s', 0, -1000)).toEqual({
      x: 240,
      y: 170,
      width: 960,
      height: 360,
    });
  });
});

describe('resizeRect viewport bounds', () => {
  it('keeps the dialog inside the right margin', () => {
    expect(drag('e', 1000, 0)).toEqual({
      x: 240,
      y: 170,
      width: 1184,
      height: 560,
    });
  });

  it('keeps the dialog inside the left margin', () => {
    expect(drag('w', -1000, 0)).toEqual({
      x: DIALOG_VIEWPORT_MARGIN,
      y: 170,
      width: 1184,
      height: 560,
    });
  });

  it('keeps the dialog inside the bottom margin', () => {
    expect(drag('s', 0, 1000)).toEqual({
      x: 240,
      y: 170,
      width: 960,
      height: 714,
    });
  });

  it('keeps the dialog inside the top margin', () => {
    expect(drag('n', 0, -1000)).toEqual({
      x: 240,
      y: DIALOG_VIEWPORT_MARGIN,
      width: 960,
      height: 714,
    });
  });
});

describe('clampRect', () => {
  it('leaves a dialog that already fits unchanged', () => {
    expect(clampRect(start, viewport)).toEqual(start);
  });

  it('shrinks the dialog when the viewport shrinks', () => {
    expect(
      clampRect(
        { x: 240, y: 170, width: 960, height: 720 },
        { width: 800, height: 600 },
      ),
    ).toEqual({
      x: DIALOG_VIEWPORT_MARGIN,
      y: DIALOG_VIEWPORT_MARGIN,
      width: 768,
      height: 568,
    });
  });

  it('pulls an off-screen dialog back into the viewport', () => {
    expect(
      clampRect({ x: 1000, y: 600, width: 480, height: 360 }, viewport),
    ).toEqual({
      x: 944,
      y: 524,
      width: 480,
      height: 360,
    });
  });
});
