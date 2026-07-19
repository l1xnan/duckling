import { beforeEach, describe, expect, it } from 'vitest';

import type { QueryContextType } from '@/stores/tabs';
import {
  getQueryChild,
  useQuerySessionStore,
} from '@/stores/querySession';

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

  it('ensure creates empty session with order/byId', () => {
    useQuerySessionStore.getState().ensure('ed1');
    expect(useQuerySessionStore.getState().byEditor.ed1).toEqual({
      order: [],
      byId: {},
    });
  });

  it('setChildren / appendChild maintain order and byId', () => {
    useQuerySessionStore.getState().setChildren('ed1', [makeChild('q1')]);
    expect(useQuerySessionStore.getState().byEditor.ed1?.order).toEqual([
      'q1',
    ]);
    expect(useQuerySessionStore.getState().byEditor.ed1?.byId.q1?.id).toBe(
      'q1',
    );

    useQuerySessionStore.getState().appendChild('ed1', makeChild('q2'));
    expect(useQuerySessionStore.getState().byEditor.ed1?.order).toEqual([
      'q1',
      'q2',
    ]);
  });

  it('patchChild only updates target byId entry', () => {
    useQuerySessionStore
      .getState()
      .setChildren('ed1', [makeChild('q1'), makeChild('q2')]);
    const prevQ2 = useQuerySessionStore.getState().byEditor.ed1?.byId.q2;

    useQuerySessionStore.getState().patchChild('ed1', 'q1', { page: 3 });
    expect(useQuerySessionStore.getState().byEditor.ed1?.byId.q1?.page).toBe(
      3,
    );
    expect(useQuerySessionStore.getState().byEditor.ed1?.byId.q2).toBe(prevQ2);

    useQuerySessionStore.getState().patchChild('ed1', 'q1', (prev) => ({
      ...prev,
      beautify: !prev.beautify,
    }));
    expect(
      useQuerySessionStore.getState().byEditor.ed1?.byId.q1?.beautify,
    ).toBe(true);
  });

  it('removeChild drops child and rewinds activeKey', () => {
    useQuerySessionStore
      .getState()
      .setChildren('ed1', [
        makeChild('q1'),
        makeChild('q2'),
        makeChild('q3'),
      ]);
    useQuerySessionStore.getState().setActiveKey('ed1', 'q2');
    useQuerySessionStore.getState().removeChild('ed1', 'q2');

    const session = useQuerySessionStore.getState().byEditor.ed1;
    expect(session?.order).toEqual(['q1', 'q3']);
    expect(session?.byId.q2).toBeUndefined();
    expect(session?.activeKey).toBe('q1');
  });

  it('removeOtherChildren keeps only target', () => {
    useQuerySessionStore
      .getState()
      .setChildren('ed1', [
        makeChild('q1'),
        makeChild('q2'),
        makeChild('q3'),
      ]);
    useQuerySessionStore.getState().removeOtherChildren('ed1', 'q2');
    const session = useQuerySessionStore.getState().byEditor.ed1;
    expect(session?.order).toEqual(['q2']);
    expect(Object.keys(session?.byId ?? {})).toEqual(['q2']);
    expect(session?.activeKey).toBe('q2');
  });

  it('getQueryChild reads byId', () => {
    useQuerySessionStore.getState().setChildren('ed1', [makeChild('q1')]);
    expect(getQueryChild('ed1', 'q1')?.displayName).toBe('q1');
    expect(getQueryChild('ed1', 'missing')).toBeUndefined();
  });

  it('clearEditor removes session', () => {
    useQuerySessionStore.getState().ensure('ed1');
    useQuerySessionStore.getState().setChildren('ed1', [makeChild('q1')]);
    useQuerySessionStore.getState().clearEditor('ed1');
    expect(useQuerySessionStore.getState().byEditor.ed1).toBeUndefined();
  });
});
