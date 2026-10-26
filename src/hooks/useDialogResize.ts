import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

import {
  centerRect,
  clampRect,
  resizeRect,
  type DialogRect,
  type DialogViewport,
  type ResizeDirection,
} from '@/lib/dialogResize';

export type DialogResizeOptions = {
  defaultWidth: number;
  defaultHeight: number;
  minWidth: number;
  minHeight: number;
};

export type DialogResizeHandlers = {
  onResizeStart: (
    direction: ResizeDirection,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => void;
  onResizeMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onResizeEnd: (event: ReactPointerEvent<HTMLDivElement>) => void;
};

const RESIZE_CURSOR: Record<ResizeDirection, string> = {
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  nw: 'nwse-resize',
  se: 'nwse-resize',
};

const DIALOG_SELECTOR = '[data-slot="dialog-content"]';

type DragState = {
  pointerId: number;
  direction: ResizeDirection;
  startRect: DialogRect;
  startX: number;
  startY: number;
  element: HTMLElement;
  rect: DialogRect;
};

function viewportSize(): DialogViewport {
  return { width: window.innerWidth, height: window.innerHeight };
}

function applyRect(element: HTMLElement, rect: DialogRect): void {
  element.style.left = `${rect.x + rect.width / 2}px`;
  element.style.top = `${rect.y + rect.height / 2}px`;
  element.style.width = `${rect.width}px`;
  element.style.height = `${rect.height}px`;
}

export function useDialogResize(options: DialogResizeOptions) {
  const { defaultWidth, defaultHeight, minWidth, minHeight } = options;
  const [rect, setRect] = useState<DialogRect>(() =>
    centerRect(defaultWidth, defaultHeight, viewportSize()),
  );
  const dragRef = useRef<DragState | null>(null);

  useEffect(() => {
    const onWindowResize = () => {
      setRect((prev) => clampRect(prev, viewportSize()));
    };
    window.addEventListener('resize', onWindowResize);
    return () => {
      window.removeEventListener('resize', onWindowResize);
      document.body.style.cursor = '';
    };
  }, []);

  const onResizeStart = (
    direction: ResizeDirection,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (event.button !== 0) {
      return;
    }
    const element = event.currentTarget.closest<HTMLElement>(DIALOG_SELECTOR);
    if (!element) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      direction,
      startRect: rect,
      startX: event.clientX,
      startY: event.clientY,
      element,
      rect,
    };
    document.body.style.cursor = RESIZE_CURSOR[direction];
  };

  const onResizeMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }
    const next = resizeRect(
      drag.startRect,
      drag.direction,
      { x: event.clientX - drag.startX, y: event.clientY - drag.startY },
      { minWidth, minHeight, viewport: viewportSize() },
    );
    drag.rect = next;
    applyRect(drag.element, next);
  };

  const onResizeEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }
    dragRef.current = null;
    document.body.style.cursor = '';
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setRect(drag.rect);
  };

  return {
    style: {
      left: rect.x + rect.width / 2,
      top: rect.y + rect.height / 2,
      width: rect.width,
      height: rect.height,
    },
    handlers: { onResizeStart, onResizeMove, onResizeEnd },
  };
}
