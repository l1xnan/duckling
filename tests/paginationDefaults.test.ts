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

import {
  DEFAULT_PER_PAGE,
  resolveDefaultPerPage,
} from '@/lib/pagination';
import { defaultSettings, getDefaultBeautify, store } from '@/stores/setting';

describe('resolveDefaultPerPage', () => {
  it('returns valid options unchanged', () => {
    expect(resolveDefaultPerPage(10)).toBe(10);
    expect(resolveDefaultPerPage(100)).toBe(100);
    expect(resolveDefaultPerPage(500)).toBe(500);
    expect(resolveDefaultPerPage(1000)).toBe(1000);
  });

  it('falls back for undefined, null, and invalid values', () => {
    expect(resolveDefaultPerPage(undefined)).toBe(DEFAULT_PER_PAGE);
    expect(resolveDefaultPerPage(null)).toBe(DEFAULT_PER_PAGE);
    expect(resolveDefaultPerPage(50)).toBe(DEFAULT_PER_PAGE);
    expect(resolveDefaultPerPage(2000)).toBe(DEFAULT_PER_PAGE);
  });
});

describe('getDefaultBeautify', () => {
  beforeEach(() => {
    memory.clear();
    store.setState({ default_beautify: defaultSettings.default_beautify });
  });

  it('uses store default_beautify when set', () => {
    store.setState({ default_beautify: false });
    expect(getDefaultBeautify()).toBe(false);
    store.setState({ default_beautify: true });
    expect(getDefaultBeautify()).toBe(true);
  });
});
