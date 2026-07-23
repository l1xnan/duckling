import { useDroppable } from '@dnd-kit/react';
import { useEffect, useRef, useState } from 'react';

import { useTabDragSession } from '@/components/tabDragSession';
import { cn } from '@/lib/utils';
import type { PaneDropZone } from '@/stores/tabLayout';

export function zoneFromPointer(
  clientX: number,
  clientY: number,
  rect: DOMRect,
): PaneDropZone {
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  const w = rect.width;
  const h = rect.height;
  const edgeX = w * 0.2;
  const edgeY = h * 0.2;

  if (x < edgeX) return 'left';
  if (x > w - edgeX) return 'right';
  if (y < edgeY) return 'up';
  if (y > h - edgeY) return 'down';
  return 'center';
}

const ZONE_STYLE: Record<
  PaneDropZone,
  { top: string; left: string; width: string; height: string }
> = {
  center: { top: '0', left: '0', width: '100%', height: '100%' },
  left: { top: '0', left: '0', width: '50%', height: '100%' },
  right: { top: '0', left: '50%', width: '50%', height: '100%' },
  up: { top: '0', left: '0', width: '100%', height: '50%' },
  down: { top: '50%', left: '0', width: '100%', height: '50%' },
};

/**
 * VS Code-style drop target over pane content.
 * Active only while a tab is being dragged.
 */
export function PaneDropOverlay({ paneId }: { paneId: string }) {
  const { activeTabId } = useTabDragSession();
  const elRef = useRef<HTMLDivElement | null>(null);
  const [zone, setZone] = useState<PaneDropZone>('center');

  const { ref, isDropTarget } = useDroppable({
    id: `pane-body:${paneId}`,
    disabled: !activeTabId,
    type: 'pane-body',
    accept: 'tab',
    data: {
      type: 'pane-body',
      paneId,
      zone,
    },
  });

  useEffect(() => {
    if (!activeTabId) {
      setZone('center');
      return;
    }
    const onMove = (e: PointerEvent) => {
      const el = elRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom
      ) {
        return;
      }
      setZone(zoneFromPointer(e.clientX, e.clientY, rect));
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, [activeTabId]);

  const setRefs = (node: HTMLDivElement | null) => {
    elRef.current = node;
    ref(node);
  };

  if (!activeTabId) {
    return null;
  }

  return (
    <div
      ref={setRefs}
      className="absolute inset-0 z-20"
      data-pane-drop={paneId}
    >
      {isDropTarget ? (
        <div
          className={cn(
            'pointer-events-none absolute rounded-sm border-2 border-primary/60 bg-primary/15 transition-[top,left,width,height] duration-75',
          )}
          style={ZONE_STYLE[zone]}
        />
      ) : null}
    </div>
  );
}
