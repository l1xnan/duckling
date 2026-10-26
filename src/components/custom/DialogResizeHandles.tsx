import type { DialogResizeHandlers } from '@/hooks/useDialogResize';
import type { ResizeDirection } from '@/lib/dialogResize';
import { cn } from '@/lib/utils';

const HANDLES: Array<{ direction: ResizeDirection; className: string }> = [
  { direction: 'n', className: 'inset-x-3 top-0 h-1.5 cursor-ns-resize' },
  { direction: 's', className: 'inset-x-3 bottom-0 h-1.5 cursor-ns-resize' },
  { direction: 'w', className: 'inset-y-3 left-0 w-1.5 cursor-ew-resize' },
  { direction: 'e', className: 'inset-y-3 right-0 w-1.5 cursor-ew-resize' },
  { direction: 'nw', className: 'top-0 left-0 size-3 cursor-nwse-resize' },
  { direction: 'ne', className: 'top-0 right-0 size-3 cursor-nesw-resize' },
  { direction: 'sw', className: 'bottom-0 left-0 size-3 cursor-nesw-resize' },
  { direction: 'se', className: 'bottom-0 right-0 size-3 cursor-nwse-resize' },
];

export function DialogResizeHandles({
  onResizeStart,
  onResizeMove,
  onResizeEnd,
}: DialogResizeHandlers) {
  return (
    <>
      {HANDLES.map(({ direction, className }) => (
        <div
          key={direction}
          aria-hidden="true"
          data-dialog-resize={direction}
          className={cn('absolute z-10 touch-none', className)}
          onPointerDown={(event) => onResizeStart(direction, event)}
          onPointerMove={onResizeMove}
          onPointerUp={onResizeEnd}
          onPointerCancel={onResizeEnd}
          onLostPointerCapture={onResizeEnd}
        />
      ))}
    </>
  );
}
