import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';

/** Logical scopes — only one “tree target” at a time; dialogs pause destructive keys. */
export type HotkeyScope = 'global' | 'editor' | 'tree' | 'dialog';

export type HotkeyCategory =
  | 'general'
  | 'editor'
  | 'tabs'
  | 'tree';

export type HotkeyId =
  | 'sidebar.toggle'
  | 'hotkeys.help'
  | 'editor.run'
  | 'editor.runNewTab'
  | 'editor.format'
  | 'editor.formatSelection'
  | 'editor.save'
  | 'tab.close'
  | 'connection.rename'
  | 'connection.properties'
  | 'connection.editor'
  | 'tree.refresh'
  | 'tree.delete'
  | 'table.copy';

export type HotkeyDef = {
  id: HotkeyId;
  /** TanStack hotkey string, e.g. `Mod+Enter`, `Shift+Alt+F`. */
  hotkey: string;
  label: MessageDescriptor;
  category: HotkeyCategory;
  scope: HotkeyScope;
  /**
   * When true, this entry is for documentation / menu labels only.
   * Actual binding is handled by Monaco / VTable (avoid double-fire).
   */
  displayOnly?: boolean;
};

export const HOTKEYS: Record<HotkeyId, HotkeyDef> = {
  'sidebar.toggle': {
    id: 'sidebar.toggle',
    hotkey: 'Mod+B',
    label: msg`Toggle sidebar`,
    category: 'general',
    scope: 'global',
  },
  'hotkeys.help': {
    id: 'hotkeys.help',
    hotkey: 'Mod+/',
    label: msg`Keyboard shortcuts`,
    category: 'general',
    scope: 'global',
  },
  'editor.run': {
    id: 'editor.run',
    hotkey: 'Mod+Enter',
    label: msg`Run SQL`,
    category: 'editor',
    scope: 'editor',
    displayOnly: true,
  },
  'editor.runNewTab': {
    id: 'editor.runNewTab',
    hotkey: 'Mod+Shift+Enter',
    label: msg`Run SQL in new tab`,
    category: 'editor',
    scope: 'editor',
  },
  'editor.format': {
    id: 'editor.format',
    hotkey: 'Shift+Alt+F',
    label: msg`Format document`,
    category: 'editor',
    scope: 'editor',
    displayOnly: true,
  },
  'editor.formatSelection': {
    id: 'editor.formatSelection',
    hotkey: 'Mod+K Mod+F',
    label: msg`Format selection`,
    category: 'editor',
    scope: 'editor',
    displayOnly: true,
  },
  'editor.save': {
    id: 'editor.save',
    hotkey: 'Mod+S',
    label: msg`Save SQL file`,
    category: 'editor',
    scope: 'editor',
  },
  'tab.close': {
    id: 'tab.close',
    hotkey: 'Mod+W',
    label: msg`Close tab`,
    category: 'tabs',
    scope: 'global',
  },
  'connection.rename': {
    id: 'connection.rename',
    hotkey: 'F2',
    label: msg`Rename connection`,
    category: 'tree',
    scope: 'tree',
  },
  'connection.properties': {
    id: 'connection.properties',
    hotkey: 'F3',
    label: msg`Connection properties`,
    category: 'tree',
    scope: 'tree',
  },
  'connection.editor': {
    id: 'connection.editor',
    hotkey: 'F4',
    label: msg`Open SQL editor`,
    category: 'tree',
    scope: 'tree',
  },
  'tree.refresh': {
    id: 'tree.refresh',
    hotkey: 'F5',
    label: msg`Refresh`,
    category: 'tree',
    scope: 'tree',
  },
  'tree.delete': {
    id: 'tree.delete',
    hotkey: 'Delete',
    label: msg`Delete connection`,
    category: 'tree',
    scope: 'tree',
  },
  'table.copy': {
    id: 'table.copy',
    hotkey: 'Mod+C',
    label: msg`Copy selection`,
    category: 'general',
    scope: 'global',
    displayOnly: true,
  },
};

export const HOTKEY_LIST: HotkeyDef[] = Object.values(HOTKEYS);

export const HOTKEY_CATEGORY_LABELS: Record<
  HotkeyCategory,
  MessageDescriptor
> = {
  general: msg`General`,
  editor: msg`Editor`,
  tabs: msg`Tabs`,
  tree: msg`Database tree`,
};

/** Detect duplicate combos within the same scope (for tests / boot assert). */
export function findHotkeyConflicts(
  defs: HotkeyDef[] = HOTKEY_LIST,
): Array<{ hotkey: string; scope: HotkeyScope; ids: HotkeyId[] }> {
  const map = new Map<string, HotkeyId[]>();
  for (const d of defs) {
    const key = `${d.scope}::${d.hotkey.toLowerCase()}`;
    const list = map.get(key) ?? [];
    list.push(d.id);
    map.set(key, list);
  }
  const conflicts: Array<{
    hotkey: string;
    scope: HotkeyScope;
    ids: HotkeyId[];
  }> = [];
  for (const [key, ids] of map) {
    if (ids.length > 1) {
      const [scope, hotkey] = key.split('::') as [HotkeyScope, string];
      conflicts.push({ scope, hotkey, ids });
    }
  }
  return conflicts;
}
