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
});
