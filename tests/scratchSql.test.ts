import { describe, expect, it } from 'vitest';

import {
  isPathLikeDocKey,
  readLegacyDocsFromLocalStorage,
} from '@/lib/migrateScratchSql';
import {
  isScratchPath,
  normalizePath,
  scratchIdFromPath,
} from '@/lib/scratchSql';
import { readLegacyWorkspaceFromLocalStorage } from '@/stores/workspaceStore';

describe('scratchSql path helpers', () => {
  it('normalizePath unifies separators and trims trailing slash', () => {
    expect(normalizePath('C:\\Users\\a\\scratch\\')).toBe('C:/Users/a/scratch');
    expect(normalizePath('/tmp/scratch//')).toBe('/tmp/scratch');
  });

  it('isScratchPath matches files under scratch dir', () => {
    const dir = 'C:/AppData/com.duckling.dev/scratch';
    expect(isScratchPath(`${dir}/abc.sql`, dir)).toBe(true);
    expect(isScratchPath(dir, dir)).toBe(true);
    expect(isScratchPath('C:/other/abc.sql', dir)).toBe(false);
    expect(isScratchPath(undefined, dir)).toBe(false);
    expect(isScratchPath(`${dir}/abc.sql`, null)).toBe(false);
  });

  it('scratchIdFromPath extracts stem', () => {
    expect(scratchIdFromPath('C:/x/scratch/abc-123.sql')).toBe('abc-123');
    expect(scratchIdFromPath('foo.txt')).toBe(null);
  });

  it('isPathLikeDocKey distinguishes folder files from scratch ids', () => {
    expect(isPathLikeDocKey('D:/sql/a.sql')).toBe(true);
    expect(isPathLikeDocKey('C:\\sql\\a.sql')).toBe(true);
    expect(isPathLikeDocKey('/home/u/a.sql')).toBe(true);
    expect(isPathLikeDocKey('V1StGXR8_Z5jdHi6B-myT')).toBe(false);
    expect(isPathLikeDocKey('abc-123_xyz')).toBe(false);
  });

  it('readLegacyDocsFromLocalStorage parses jotai docs key', () => {
    const memory: Record<string, string> = {};
    const ls = {
      getItem: (k: string) => memory[k] ?? null,
      setItem: (k: string, v: string) => {
        memory[k] = v;
      },
      removeItem: (k: string) => {
        delete memory[k];
      },
    };
    Object.defineProperty(globalThis, 'localStorage', {
      value: ls,
      configurable: true,
    });

    localStorage.setItem(
      'docs',
      JSON.stringify({ a1: 'select 1', 'D:/x.sql': 'select 2' }),
    );
    expect(readLegacyDocsFromLocalStorage()).toEqual({
      a1: 'select 1',
      'D:/x.sql': 'select 2',
    });
    localStorage.removeItem('docs');
    expect(readLegacyDocsFromLocalStorage()).toEqual({});
  });

  it('readLegacyWorkspaceFromLocalStorage merges jotai keys', () => {
    const memory: Record<string, string> = {};
    const ls = {
      getItem: (k: string) => memory[k] ?? null,
      setItem: (k: string, v: string) => {
        memory[k] = v;
      },
      removeItem: (k: string) => {
        delete memory[k];
      },
    };
    Object.defineProperty(globalThis, 'localStorage', {
      value: ls,
      configurable: true,
    });

    expect(readLegacyWorkspaceFromLocalStorage()).toBe(null);

    localStorage.setItem('sqlFolders', JSON.stringify(['D:/sql']));
    localStorage.setItem(
      'sqlBookmarks',
      JSON.stringify([
        {
          id: 'b1',
          dbId: 'c1',
          stmt: 'select 1',
          title: 't',
          createdAt: 1,
        },
      ]),
    );
    localStorage.setItem(
      'runs',
      JSON.stringify([{ id: 'r1', type: 'query', dbId: 'c1', stmt: 'x' }]),
    );
    localStorage.setItem(
      'favorite',
      JSON.stringify([{ id: 'e1', type: 'editor', dbId: 'c1', displayName: 'e' }]),
    );

    const w = readLegacyWorkspaceFromLocalStorage();
    expect(w?.sqlFolders).toEqual(['D:/sql']);
    expect(w?.bookmarks).toHaveLength(1);
    expect(w?.runs).toHaveLength(1);
    expect(w?.favorite).toHaveLength(1);
  });
});
