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
  return { memory, localStorage };
});

import { useQuerySessionStore } from '@/stores/querySession';
import { useTabsStore, type TabContextType } from '@/stores/tabs';

function editorTab(id: string): TabContextType {
  return {
    id,
    dbId: 'db1',
    type: 'editor',
    displayName: id,
  };
}

function tableTab(id: string): TabContextType {
  return {
    id,
    dbId: 'db1',
    tableId: 't1',
    type: 'table',
    displayName: id,
  };
}

describe('tabsStore P0 invariants', () => {
  beforeEach(() => {
    memory.clear();
    useTabsStore.setState({ ids: [], tabs: {}, currentId: null });
    useQuerySessionStore.setState({ byEditor: {} });
  });

  it('update is immutable and upserts + activates', () => {
    const first = editorTab('e1');
    useTabsStore.getState().update(first);

    const afterFirst = useTabsStore.getState();
    expect(afterFirst.ids).toEqual(['e1']);
    expect(afterFirst.currentId).toBe('e1');
    expect(afterFirst.tabs.e1).toEqual(first);

    const prevIds = afterFirst.ids;
    const prevTabs = afterFirst.tabs;

    const second = { ...first, displayName: 'renamed' };
    useTabsStore.getState().update(second);

    const afterSecond = useTabsStore.getState();
    expect(afterSecond.ids).toBe(prevIds);
    expect(afterSecond.tabs).not.toBe(prevTabs);
    expect(afterSecond.tabs.e1?.displayName).toBe('renamed');
    expect(afterSecond.currentId).toBe('e1');
  });

  it('append does not duplicate ids', () => {
    const tab = tableTab('t1');
    useTabsStore.getState().append(tab);
    useTabsStore.getState().append({ ...tab, displayName: 'again' });
    expect(useTabsStore.getState().ids).toEqual(['t1']);
    expect(useTabsStore.getState().tabs.t1?.displayName).toBe('again');
  });

  it('patch merges without replacing whole tab map identity incorrectly', () => {
    useTabsStore.getState().update(tableTab('t1'));
    const prevTabs = useTabsStore.getState().tabs;
    useTabsStore.getState().patch('t1', { displayName: 'patched' });
    const next = useTabsStore.getState();
    expect(next.tabs).not.toBe(prevTabs);
    expect(next.tabs.t1?.displayName).toBe('patched');
    expect(next.ids).toEqual(['t1']);
  });

  it('remove clears query session after state update when tab is dropped', () => {
    const clearEditor = vi.spyOn(
      useQuerySessionStore.getState(),
      'clearEditor',
    );
    useTabsStore.getState().update(tableTab('t1'));
    useQuerySessionStore.getState().ensure('t1');

    useTabsStore.getState().remove('t1');

    expect(useTabsStore.getState().ids).toEqual([]);
    expect(useTabsStore.getState().tabs.t1).toBeUndefined();
    expect(clearEditor).toHaveBeenCalledWith('t1');
    clearEditor.mockRestore();
  });

  it('remove without force keeps editor tab object but drops from ids', () => {
    useTabsStore.getState().update(editorTab('e1'));
    useTabsStore.getState().remove('e1', false);

    expect(useTabsStore.getState().ids).toEqual([]);
    expect(useTabsStore.getState().tabs.e1).toBeDefined();
  });

  it('remove force drops editor and clears session', () => {
    useTabsStore.getState().update(editorTab('e1'));
    useQuerySessionStore.getState().appendChild('e1', {
      id: 'q1',
      dbId: 'db1',
      tableId: 't',
      type: 'query',
      displayName: 'q1',
      page: 1,
      perPage: 10,
      total: 0,
      elapsed: 0,
      hiddenColumns: {},
      direction: 'horizontal',
      cross: false,
    } as never);

    useTabsStore.getState().remove('e1', true);

    expect(useTabsStore.getState().tabs.e1).toBeUndefined();
    expect(useQuerySessionStore.getState().byEditor.e1).toBeUndefined();
  });
});
