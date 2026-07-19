import { describe, expect, it } from 'vitest';

import { formatHotkey } from '@/hotkeys/format';
import { findHotkeyConflicts, HOTKEY_LIST, HOTKEYS } from '@/hotkeys/registry';

describe('formatHotkey', () => {
  it('formats Mod+Enter for Windows', () => {
    expect(formatHotkey('Mod+Enter', false)).toBe('Ctrl+Enter');
  });

  it('formats Mod+Enter for Mac', () => {
    expect(formatHotkey('Mod+Enter', true)).toBe('⌘↵');
  });

  it('formats chords', () => {
    expect(formatHotkey('Mod+K Mod+F', false)).toBe('Ctrl+K Ctrl+F');
    expect(formatHotkey('Mod+K Mod+F', true)).toBe('⌘K ⌘F');
  });

  it('formats function keys', () => {
    expect(formatHotkey('F5', false)).toBe('F5');
    expect(formatHotkey('Delete', false)).toBe('Del');
  });
});

describe('hotkey registry', () => {
  it('has unique ids', () => {
    const ids = HOTKEY_LIST.map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has no conflicts within the same scope', () => {
    expect(findHotkeyConflicts()).toEqual([]);
  });

  it('exposes expected core bindings', () => {
    expect(HOTKEYS['editor.run'].hotkey).toBe('Mod+Enter');
    expect(HOTKEYS['editor.run'].displayOnly).toBe(true);
    expect(HOTKEYS['hotkeys.help'].hotkey).toBe('Mod+/');
    expect(HOTKEYS['tree.refresh'].hotkey).toBe('F5');
  });
});
