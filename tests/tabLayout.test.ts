import { describe, expect, it } from 'vitest';

import {
  collectTabIds,
  createDefaultLayout,
  createLeaf,
  findLeafByTab,
  isLeaf,
  isSplit,
  moveTab,
  removeTabFromLayout,
  splitLeaf,
} from '@/stores/tabLayout';

describe('tabLayout', () => {
  it('split right moves tab into new pane', () => {
    const leaf = createLeaf(['a', 'b'], 'a');
    const result = splitLeaf(leaf, leaf.id, 'a', 'right');
    expect(result).not.toBeNull();
    const layout = result!.layout;
    expect(isSplit(layout)).toBe(true);
    if (!isSplit(layout)) return;
    expect(layout.orientation).toBe('horizontal');
    expect(collectTabIds(layout).sort()).toEqual(['a', 'b']);
    expect(findLeafByTab(layout, 'a')?.id).toBe(result!.newPaneId);
    expect(findLeafByTab(layout, 'b')?.tabIds).toEqual(['b']);
  });

  it('split down uses vertical orientation', () => {
    const leaf = createLeaf(['a', 'b'], 'b');
    const result = splitLeaf(leaf, leaf.id, 'b', 'down');
    expect(result).not.toBeNull();
    if (!isSplit(result!.layout)) return;
    expect(result!.layout.orientation).toBe('vertical');
  });

  it('moveTab reorders within the same pane', () => {
    const leaf = createLeaf(['a', 'b', 'c'], 'a');
    const next = moveTab(leaf, 'c', leaf.id, 0);
    expect(isLeaf(next)).toBe(true);
    if (!isLeaf(next)) return;
    expect(next.tabIds).toEqual(['c', 'a', 'b']);
  });

  it('moveTab moves across panes and collapses empty source', () => {
    const left = createLeaf(['a'], 'a', 'left');
    const right = createLeaf(['b'], 'b', 'right');
    const split = {
      type: 'split' as const,
      id: 's1',
      orientation: 'horizontal' as const,
      sizes: [50, 50] as [number, number],
      children: [left, right] as [typeof left, typeof right],
    };
    const next = moveTab(split, 'a', 'right', 1);
    expect(isLeaf(next)).toBe(true);
    if (!isLeaf(next)) return;
    expect(next.tabIds).toEqual(['b', 'a']);
  });

  it('removeTabFromLayout collapses empty pane', () => {
    const left = createLeaf(['a'], 'a', 'left');
    const right = createLeaf(['b'], 'b', 'right');
    const split = {
      type: 'split' as const,
      id: 's1',
      orientation: 'horizontal' as const,
      sizes: [50, 50] as [number, number],
      children: [left, right] as [typeof left, typeof right],
    };
    const { layout } = removeTabFromLayout(split, 'a');
    expect(isLeaf(layout)).toBe(true);
    if (!isLeaf(layout)) return;
    expect(layout.tabIds).toEqual(['b']);
  });

  it('createDefaultLayout seeds activeId', () => {
    const leaf = createDefaultLayout(['x', 'y'], 'y');
    expect(leaf.tabIds).toEqual(['x', 'y']);
    expect(leaf.activeId).toBe('y');
  });
});
