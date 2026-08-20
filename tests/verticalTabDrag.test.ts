import { beforeEach, describe, expect, it, vi } from 'vitest';

const { memory } = vi.hoisted(() => {
  const memory = new Map<string, string>();
  const localStorage = {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => {
      memory.set(k, v);
    },
    removeItem: (k: string) => {
      memory.delete(k);
    },
    clear: () => {
      memory.clear();
    },
    key: (_i: number) => null as string | null,
    get length() {
      return memory.size;
    },
  };
  Object.defineProperty(globalThis, 'localStorage', {
    value: localStorage,
    configurable: true,
    writable: true,
  });
  return { memory };
});

import { applyVerticalTabDrop } from '@/components/verticalTabDrag';
import { useTabsStore, type TabContextType } from '@/stores/tabs';

function editorTab(id: string): TabContextType {
  return {
    id,
    dbId: 'db1',
    type: 'editor',
    displayName: id,
  };
}

describe('verticalTabDrag', () => {
  beforeEach(() => {
    memory.clear();
    const leaf = {
      type: 'leaf' as const,
      id: 'pane-root',
      tabIds: ['a', 'b', 'c'] as string[],
      activeId: 'a' as string | null,
    };
    useTabsStore.setState({
      ids: ['a', 'b', 'c'],
      tabs: {
        a: editorTab('a'),
        b: editorTab('b'),
        c: editorTab('c'),
      },
      currentId: 'a',
      layout: leaf,
      focusedPaneId: leaf.id,
    });
  });

  it('reorders tabs within the owning pane', () => {
    applyVerticalTabDrop({ tabId: 'c', index: 0 });
    expect(useTabsStore.getState().ids).toEqual(['c', 'a', 'b']);
  });

  it('no-ops when dropped in the same slot', () => {
    applyVerticalTabDrop({ tabId: 'b', index: 2 });
    expect(useTabsStore.getState().ids).toEqual(['a', 'b', 'c']);
  });
});
