import { useCallback, type ReactNode } from 'react';
import { useShallow } from 'zustand/shallow';

import { PaneDropOverlay } from '@/components/PaneDropOverlay';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import {
  isLeaf,
  type PaneLeaf,
  type PaneNode,
  type PaneSplit,
} from '@/stores/tabLayout';
import { useTabsStore } from '@/stores/tabs';

export function TabPaneLayout({
  renderPane,
}: {
  renderPane: (leaf: PaneLeaf, focused: boolean) => ReactNode;
}) {
  const { layout, focusedPaneId, setPaneSizes } = useTabsStore(
    useShallow((s) => ({
      layout: s.layout,
      focusedPaneId: s.focusedPaneId,
      setPaneSizes: s.setPaneSizes,
    })),
  );

  return (
    <div className="size-full min-h-0 min-w-0">
      <PaneNodeView
        node={layout}
        focusedPaneId={focusedPaneId}
        setPaneSizes={setPaneSizes}
        renderPane={renderPane}
      />
    </div>
  );
}

function PaneNodeView({
  node,
  focusedPaneId,
  setPaneSizes,
  renderPane,
}: {
  node: PaneNode;
  focusedPaneId: string;
  setPaneSizes: (splitId: string, sizes: [number, number]) => void;
  renderPane: (leaf: PaneLeaf, focused: boolean) => ReactNode;
}) {
  if (isLeaf(node)) {
    return (
      <LeafPane
        key={node.id}
        leaf={node}
        focused={node.id === focusedPaneId}
        renderPane={renderPane}
      />
    );
  }
  return (
    <SplitPane
      key={node.id}
      split={node}
      focusedPaneId={focusedPaneId}
      setPaneSizes={setPaneSizes}
      renderPane={renderPane}
    />
  );
}

function LeafPane({
  leaf,
  focused,
  renderPane,
}: {
  leaf: PaneLeaf;
  focused: boolean;
  renderPane: (leaf: PaneLeaf, focused: boolean) => ReactNode;
}) {
  const focusPane = useTabsStore((s) => s.focusPane);

  return (
    <div
      className="relative size-full min-h-0 min-w-0 flex flex-col overflow-hidden"
      onMouseDownCapture={(e) => {
        if (focused) return;
        if ((e.target as HTMLElement).closest('[data-tab-bar]')) return;
        focusPane(leaf.id);
      }}
    >
      {renderPane(leaf, focused)}
      <PaneDropOverlay paneId={leaf.id} />
    </div>
  );
}

function SplitPane({
  split,
  focusedPaneId,
  setPaneSizes,
  renderPane,
}: {
  split: PaneSplit;
  focusedPaneId: string;
  setPaneSizes: (splitId: string, sizes: [number, number]) => void;
  renderPane: (leaf: PaneLeaf, focused: boolean) => ReactNode;
}) {
  const [leftSize, rightSize] = split.sizes;
  const leftId = split.children[0].id;
  const rightId = split.children[1].id;

  const onLayoutChanged = useCallback(
    (layout: Record<string, number>, meta?: { isUserInteraction?: boolean }) => {
      if (meta && meta.isUserInteraction === false) {
        return;
      }
      const a = layout[String(leftId)];
      const b = layout[String(rightId)];
      if (typeof a === 'number' && typeof b === 'number') {
        setPaneSizes(split.id, [a, b]);
      }
    },
    [leftId, rightId, setPaneSizes, split.id],
  );

  return (
    <ResizablePanelGroup
      id={split.id}
      orientation={split.orientation}
      className="size-full"
      defaultLayout={{
        [String(leftId)]: leftSize,
        [String(rightId)]: rightSize,
      }}
      onLayoutChanged={onLayoutChanged}
    >
      <ResizablePanel id={leftId} defaultSize={`${leftSize}`} minSize="15">
        <PaneNodeView
          node={split.children[0]}
          focusedPaneId={focusedPaneId}
          setPaneSizes={setPaneSizes}
          renderPane={renderPane}
        />
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel id={rightId} defaultSize={`${rightSize}`} minSize="15">
        <PaneNodeView
          node={split.children[1]}
          focusedPaneId={focusedPaneId}
          setPaneSizes={setPaneSizes}
          renderPane={renderPane}
        />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

