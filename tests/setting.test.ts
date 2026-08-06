import { describe, expect, it } from 'vitest';

import {
  defaultSettings,
  resolveActiveSlots,
  resolvePanelSide,
  resolveSidebarLayout,
} from '@/stores/setting';

describe('sidebar layout helpers', () => {
  it('resolveSidebarLayout falls back to defaults for missing fields', () => {
    expect(resolveSidebarLayout(undefined)).toEqual(defaultSettings.sidebar);
    expect(resolveSidebarLayout({})).toEqual(defaultSettings.sidebar);
  });

  it('resolveSidebarLayout preserves per-panel overrides and merges global side', () => {
    const { side, panelSides } = resolveSidebarLayout({
      side: 'right',
      panelSides: { database: 'right' },
    });
    expect(side).toBe('right');
    expect(panelSides?.database).toBe('right');
    expect(panelSides?.tabs).toBeUndefined();
  });

  it('resolvePanelSide falls back to the global side without an override', () => {
    expect(resolvePanelSide(undefined, 'database', 'left')).toBe('left');
    expect(resolvePanelSide({}, 'database', 'right')).toBe('right');
    expect(resolvePanelSide({ favorite: 'right' }, 'tabs', 'left')).toBe('left');
  });

  it('resolvePanelSide honors the per-panel override', () => {
    expect(resolvePanelSide({ database: 'right' }, 'database', 'left')).toBe(
      'right',
    );
    expect(resolvePanelSide({ history: 'left' }, 'history', 'right')).toBe(
      'left',
    );
  });
});

describe('resolveActiveSlots (one panel per side)', () => {
  const layout = (side: 'left' | 'right', overrides = {}) =>
    resolveSidebarLayout({ side, panelSides: overrides });

  it('places a single open panel on its effective side', () => {
    expect(
      resolveActiveSlots({ left: 'database', right: null }, layout('left')),
    ).toEqual({ left: 'database', right: null });
    expect(
      resolveActiveSlots(
        { left: 'database', right: null },
        layout('left', { database: 'right' }),
      ),
    ).toEqual({ left: null, right: 'database' });
  });

  it('keeps two panels open on opposite sides', () => {
    expect(
      resolveActiveSlots(
        { left: 'database', right: 'tabs' },
        layout('left', { tabs: 'right' }),
      ),
    ).toEqual({ left: 'database', right: 'tabs' });
  });

  it('moves a panel whose dock side changed while open', () => {
    const active = { left: 'history', right: null };
    const moved = layout('left', { history: 'right' });
    expect(resolveActiveSlots(active, moved)).toEqual({
      left: null,
      right: 'history',
    });
  });
});