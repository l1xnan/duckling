import { beforeEach, describe, expect, it } from 'vitest';

import type { QueryContextType } from '@/stores/tabs';
import { useQuerySessionStore } from '@/stores/querySession';

function makeChild(
  id: string,
  extra: Partial<QueryContextType> = {},
): QueryContextType {
  return {
    id,
    dbId: 'db1',
    tableId: 't1',
    type: 'query',
    displayName: id,
    page: 1,
    perPage: 500,
    total: 0,
    elapsed: 0,
    hiddenColumns: {},
    direction: 'horizontal',
    cross: false,
    ...extra,
  } as QueryContextType;
}

describe('querySessionStore', () => {
  beforeEach(() => {
    useQuerySessionStore.setState({ byEditor: {} });
  });

  it('ensure creates empty session', () => {
    useQuerySessionStore.getState().ensure('ed1');
    expect(useQuerySessionStore.getState().byEditor.ed1).toEqual({
      children: [],
    });
  });

  it('setChildren appends query results', () => {
    useQuerySessionStore.getState().setChildren('ed1', [makeChild('q1')]);
    expect(
      useQuerySessionStore.getState().byEditor.ed1?.children.map((c) => c.id),
    ).toEqual(['q1']);

    useQuerySessionStore
      .getState()
      .setChildren('ed1', (prev) => [...prev, makeChild('q2')]);
    expect(
      useQuerySessionStore.getState().byEditor.ed1?.children.map((c) => c.id),
    ).toEqual(['q1', 'q2']);
  });

  it('patchChild merges fields', () => {
    useQuerySessionStore.getState().setChildren('ed1', [makeChild('q1')]);
    useQuerySessionStore.getState().patchChild('ed1', 'q1', { page: 3 });
    expect(
      useQuerySessionStore.getState().byEditor.ed1?.children[0]?.page,
    ).toBe(3);

    useQuerySessionStore
      .getState()
      .patchChild('ed1', 'q1', (prev) => ({
        ...prev,
        beautify: !prev.beautify,
      }));
    expect(
      useQuerySessionStore.getState().byEditor.ed1?.children[0]?.beautify,
    ).toBe(true);
  });

  it('removeChild drops child and rewinds activeKey', () => {
    useQuerySessionStore.getState().setChildren('ed1', [
      makeChild('q1'),
      makeChild('q2'),
      makeChild('q3'),
    ]);
    useQuerySessionStore.getState().setActiveKey('ed1', 'q2');
    useQuerySessionStore.getState().removeChild('ed1', 'q2');

    const session = useQuerySessionStore.getState().byEditor.ed1;
    expect(session?.children.map((c) => c.id)).toEqual(['q1', 'q3']);
    expect(session?.activeKey).toBe('q1');
  });

  it('removeOtherChildren keeps only target', () => {
    useQuerySessionStore.getState().setChildren('ed1', [
      makeChild('q1'),
      makeChild('q2'),
      makeChild('q3'),
    ]);
    useQuerySessionStore.getState().removeOtherChildren('ed1', 'q2');
    const session = useQuerySessionStore.getState().byEditor.ed1;
    expect(session?.children.map((c) => c.id)).toEqual(['q2']);
    expect(session?.activeKey).toBe('q2');
  });

  it('clearEditor removes session', () => {
    useQuerySessionStore.getState().ensure('ed1');
    useQuerySessionStore.getState().setChildren('ed1', [makeChild('q1')]);
    useQuerySessionStore.getState().clearEditor('ed1');
    expect(useQuerySessionStore.getState().byEditor.ed1).toBeUndefined();
  });
});
