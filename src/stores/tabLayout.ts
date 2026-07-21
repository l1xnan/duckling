import { nanoid } from 'nanoid';

export type PaneId = string;

export type PaneLeaf = {
  type: 'leaf';
  id: PaneId;
  tabIds: string[];
  activeId?: string | null;
};

export type PaneSplit = {
  type: 'split';
  id: PaneId;
  orientation: 'horizontal' | 'vertical';
  children: [PaneNode, PaneNode];
  sizes: [number, number];
};

export type PaneNode = PaneLeaf | PaneSplit;

export type SplitDirection = 'right' | 'down';

export function createLeaf(
  tabIds: string[] = [],
  activeId?: string | null,
  id?: PaneId,
): PaneLeaf {
  return {
    type: 'leaf',
    id: id ?? nanoid(),
    tabIds,
    activeId: activeId ?? tabIds[tabIds.length - 1] ?? null,
  };
}

export function createDefaultLayout(tabIds: string[] = [], activeId?: string | null): PaneLeaf {
  return createLeaf(tabIds, activeId);
}

export function isLeaf(node: PaneNode): node is PaneLeaf {
  return node.type === 'leaf';
}

export function isSplit(node: PaneNode): node is PaneSplit {
  return node.type === 'split';
}

export function collectTabIds(node: PaneNode): string[] {
  if (isLeaf(node)) {
    return [...node.tabIds];
  }
  return [...collectTabIds(node.children[0]), ...collectTabIds(node.children[1])];
}

export function collectLeaves(node: PaneNode): PaneLeaf[] {
  if (isLeaf(node)) {
    return [node];
  }
  return [...collectLeaves(node.children[0]), ...collectLeaves(node.children[1])];
}

export function findLeaf(node: PaneNode, paneId: PaneId): PaneLeaf | null {
  if (isLeaf(node)) {
    return node.id === paneId ? node : null;
  }
  return findLeaf(node.children[0], paneId) ?? findLeaf(node.children[1], paneId);
}

export function findLeafByTab(node: PaneNode, tabId: string): PaneLeaf | null {
  if (isLeaf(node)) {
    return node.tabIds.includes(tabId) ? node : null;
  }
  return findLeafByTab(node.children[0], tabId) ?? findLeafByTab(node.children[1], tabId);
}

export function mapTree(node: PaneNode, fn: (n: PaneNode) => PaneNode): PaneNode {
  const next = fn(node);
  if (isLeaf(next)) {
    return next;
  }
  const left = mapTree(next.children[0], fn);
  const right = mapTree(next.children[1], fn);
  if (left === next.children[0] && right === next.children[1] && next === node) {
    return node;
  }
  return { ...next, children: [left, right] };
}

export function updateLeaf(
  node: PaneNode,
  paneId: PaneId,
  updater: (leaf: PaneLeaf) => PaneLeaf,
): PaneNode {
  if (isLeaf(node)) {
    return node.id === paneId ? updater(node) : node;
  }
  const left = updateLeaf(node.children[0], paneId, updater);
  const right = updateLeaf(node.children[1], paneId, updater);
  if (left === node.children[0] && right === node.children[1]) {
    return node;
  }
  return { ...node, children: [left, right] };
}

export function setSplitSizes(
  node: PaneNode,
  splitId: PaneId,
  sizes: [number, number],
): PaneNode {
  if (isLeaf(node)) {
    return node;
  }
  if (node.id === splitId) {
    return { ...node, sizes };
  }
  const left = setSplitSizes(node.children[0], splitId, sizes);
  const right = setSplitSizes(node.children[1], splitId, sizes);
  if (left === node.children[0] && right === node.children[1]) {
    return node;
  }
  return { ...node, children: [left, right] };
}

/** Remove empty leaves and collapse single-child splits. */
export function collapseEmpty(node: PaneNode): PaneNode {
  if (isLeaf(node)) {
    return node;
  }
  const left = collapseEmpty(node.children[0]);
  const right = collapseEmpty(node.children[1]);

  const leftEmpty = isLeaf(left) && left.tabIds.length === 0;
  const rightEmpty = isLeaf(right) && right.tabIds.length === 0;

  if (leftEmpty && rightEmpty) {
    return createLeaf([], null, left.id);
  }
  if (leftEmpty) {
    return right;
  }
  if (rightEmpty) {
    return left;
  }
  if (left === node.children[0] && right === node.children[1]) {
    return node;
  }
  return { ...node, children: [left, right] };
}

export function ensureActive(leaf: PaneLeaf, preferred?: string | null): PaneLeaf {
  if (preferred && leaf.tabIds.includes(preferred)) {
    return leaf.activeId === preferred ? leaf : { ...leaf, activeId: preferred };
  }
  if (leaf.activeId && leaf.tabIds.includes(leaf.activeId)) {
    return leaf;
  }
  const activeId = leaf.tabIds[leaf.tabIds.length - 1] ?? null;
  return leaf.activeId === activeId ? leaf : { ...leaf, activeId };
}

export function addTabToLeaf(
  leaf: PaneLeaf,
  tabId: string,
  activate: boolean,
): PaneLeaf {
  if (leaf.tabIds.includes(tabId)) {
    return activate ? ensureActive(leaf, tabId) : leaf;
  }
  const next: PaneLeaf = {
    ...leaf,
    tabIds: [...leaf.tabIds, tabId],
  };
  return activate ? ensureActive(next, tabId) : ensureActive(next, leaf.activeId);
}

export function removeTabFromLayout(
  node: PaneNode,
  tabId: string,
): { layout: PaneNode; removedFrom: PaneLeaf | null } {
  let removedFrom: PaneLeaf | null = null;

  const walk = (n: PaneNode): PaneNode => {
    if (isLeaf(n)) {
      if (!n.tabIds.includes(tabId)) {
        return n;
      }
      const idx = n.tabIds.indexOf(tabId);
      const tabIds = n.tabIds.filter((id) => id !== tabId);
      let activeId = n.activeId;
      if (activeId === tabId) {
        activeId = tabIds[idx - 1] ?? tabIds[idx] ?? null;
      }
      const next = ensureActive({ ...n, tabIds, activeId }, activeId);
      removedFrom = next;
      return next;
    }
    return {
      ...n,
      children: [walk(n.children[0]), walk(n.children[1])],
    };
  };

  const layout = collapseEmpty(walk(node));
  return { layout, removedFrom };
}

export function splitLeaf(
  node: PaneNode,
  paneId: PaneId,
  tabId: string,
  direction: SplitDirection,
): { layout: PaneNode; newPaneId: PaneId } | null {
  const orientation = direction === 'right' ? 'horizontal' : 'vertical';
  let newPaneId: PaneId | null = null;

  const walk = (n: PaneNode): PaneNode => {
    if (isLeaf(n)) {
      if (n.id !== paneId) {
        return n;
      }
      if (!n.tabIds.includes(tabId)) {
        return n;
      }

      // Move tab into a new sibling pane; keep empty source leaf (collapsed only on close).
      const remaining = n.tabIds.filter((id) => id !== tabId);
      const source = ensureActive({ ...n, tabIds: remaining }, n.activeId === tabId ? null : n.activeId);
      const target = createLeaf([tabId], tabId);
      newPaneId = target.id;
      return {
        type: 'split',
        id: nanoid(),
        orientation,
        sizes: [50, 50],
        children: [source, target],
      };
    }
    return {
      ...n,
      children: [walk(n.children[0]), walk(n.children[1])],
    };
  };

  const layout = walk(node);
  if (!newPaneId) {
    return null;
  }
  return { layout, newPaneId };
}

export function moveTab(
  node: PaneNode,
  tabId: string,
  toPaneId: PaneId,
  index?: number,
): PaneNode {
  const fromLeaf = findLeafByTab(node, tabId);
  if (!fromLeaf) {
    return node;
  }
  const toLeaf = findLeaf(node, toPaneId);
  if (!toLeaf) {
    return node;
  }

  // Same pane reorder
  if (fromLeaf.id === toPaneId) {
    const fromIdx = fromLeaf.tabIds.indexOf(tabId);
    if (fromIdx < 0) {
      return node;
    }
    const tabIds = [...fromLeaf.tabIds];
    tabIds.splice(fromIdx, 1);
    const insertAt = index === undefined ? tabIds.length : Math.max(0, Math.min(index, tabIds.length));
    // Adjust index if removing before insert point
    const adjusted =
      fromIdx < insertAt ? insertAt - 1 : insertAt;
    tabIds.splice(adjusted, 0, tabId);
    return updateLeaf(node, toPaneId, (leaf) =>
      ensureActive({ ...leaf, tabIds }, leaf.activeId),
    );
  }

  // Cross pane
  let layout = updateLeaf(node, fromLeaf.id, (leaf) => {
    const tabIds = leaf.tabIds.filter((id) => id !== tabId);
    let activeId = leaf.activeId;
    if (activeId === tabId) {
      const idx = leaf.tabIds.indexOf(tabId);
      activeId = tabIds[idx - 1] ?? tabIds[idx] ?? null;
    }
    return ensureActive({ ...leaf, tabIds, activeId }, activeId);
  });

  layout = updateLeaf(layout, toPaneId, (leaf) => {
    if (leaf.tabIds.includes(tabId)) {
      return ensureActive(leaf, tabId);
    }
    const tabIds = [...leaf.tabIds];
    const insertAt =
      index === undefined ? tabIds.length : Math.max(0, Math.min(index, tabIds.length));
    tabIds.splice(insertAt, 0, tabId);
    return ensureActive({ ...leaf, tabIds }, tabId);
  });

  return collapseEmpty(layout);
}

export function resolveCurrentId(
  layout: PaneNode,
  focusedPaneId: PaneId | null | undefined,
): string | null {
  const focused = focusedPaneId ? findLeaf(layout, focusedPaneId) : null;
  if (focused?.activeId) {
    return focused.activeId;
  }
  const leaves = collectLeaves(layout);
  for (const leaf of leaves) {
    if (leaf.activeId) {
      return leaf.activeId;
    }
  }
  return collectTabIds(layout)[0] ?? null;
}

export function resolveFocusedPaneId(
  layout: PaneNode,
  preferred?: PaneId | null,
): PaneId {
  if (preferred && findLeaf(layout, preferred)) {
    return preferred;
  }
  const leaves = collectLeaves(layout);
  const withTabs = leaves.find((l) => l.tabIds.length > 0);
  return (withTabs ?? leaves[0] ?? createLeaf()).id;
}

/** Rebuild layout from flat ids when migrating or recovering. */
export function layoutFromIds(ids: string[], activeId?: string | null): PaneLeaf {
  return createLeaf(ids, activeId);
}

/** Ensure every id is in layout; drop layout tabs not in ids set if provided. */
export function syncLayoutWithIds(
  layout: PaneNode,
  ids: string[],
  activeId?: string | null,
  focusedPaneId?: PaneId | null,
): { layout: PaneNode; focusedPaneId: PaneId; currentId: string | null } {
  const inLayout = new Set(collectTabIds(layout));
  let next = layout;

  // Remove tabs no longer in ids
  for (const tabId of inLayout) {
    if (!ids.includes(tabId)) {
      next = removeTabFromLayout(next, tabId).layout;
    }
  }

  // Add missing ids to focused/first leaf
  const missing = ids.filter((id) => !collectTabIds(next).includes(id));
  if (missing.length) {
    const focusId = resolveFocusedPaneId(next, focusedPaneId);
    next = updateLeaf(next, focusId, (leaf) => {
      let l = leaf;
      for (const id of missing) {
        l = addTabToLeaf(l, id, false);
      }
      return l;
    });
  }

  // If layout empty but ids exist
  if (collectLeaves(next).length === 0 || (isLeaf(next) && next.tabIds.length === 0 && ids.length)) {
    next = layoutFromIds(ids, activeId);
  }

  const focus = resolveFocusedPaneId(next, focusedPaneId);
  const withActive = activeId
    ? updateLeaf(next, findLeafByTab(next, activeId)?.id ?? focus, (leaf) =>
        leaf.tabIds.includes(activeId) ? ensureActive(leaf, activeId) : leaf,
      )
    : next;

  const focusedPaneIdResolved = resolveFocusedPaneId(withActive, focus);
  return {
    layout: withActive,
    focusedPaneId: focusedPaneIdResolved,
    currentId: resolveCurrentId(withActive, focusedPaneIdResolved),
  };
}
