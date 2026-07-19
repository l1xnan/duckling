/** Platform-aware hotkey display helpers. */

export function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);
}

const MAC_SYMBOLS: Record<string, string> = {
  mod: '⌘',
  meta: '⌘',
  cmd: '⌘',
  command: '⌘',
  ctrl: '⌃',
  control: '⌃',
  alt: '⌥',
  option: '⌥',
  shift: '⇧',
  enter: '↵',
  return: '↵',
  escape: 'Esc',
  esc: 'Esc',
  delete: '⌫',
  backspace: '⌫',
  space: 'Space',
  arrowup: '↑',
  arrowdown: '↓',
  arrowleft: '←',
  arrowright: '→',
};

const WIN_LABELS: Record<string, string> = {
  mod: 'Ctrl',
  meta: 'Win',
  cmd: 'Ctrl',
  command: 'Ctrl',
  ctrl: 'Ctrl',
  control: 'Ctrl',
  alt: 'Alt',
  option: 'Alt',
  shift: 'Shift',
  enter: 'Enter',
  return: 'Enter',
  escape: 'Esc',
  esc: 'Esc',
  delete: 'Del',
  backspace: 'Backspace',
  space: 'Space',
  arrowup: '↑',
  arrowdown: '↓',
  arrowleft: '←',
  arrowright: '→',
};

function formatToken(token: string, mac: boolean): string {
  const t = token.trim().toLowerCase();
  if (!t) return '';
  const map = mac ? MAC_SYMBOLS : WIN_LABELS;
  if (map[t]) return map[t];
  // Function keys / single letters
  if (/^f\d{1,2}$/i.test(t)) return t.toUpperCase();
  if (t.length === 1) return t.toUpperCase();
  return token.trim();
}

/**
 * Format a TanStack-style hotkey for UI.
 * Supports chords: `Mod+K Mod+F` → `⌘K ⌘F` / `Ctrl+K Ctrl+F`
 */
export function formatHotkey(hotkey: string, mac = isMacPlatform()): string {
  return hotkey
    .split(/\s+/)
    .filter(Boolean)
    .map((chord) => {
      const parts = chord.split('+').map((p) => formatToken(p, mac));
      return mac ? parts.join('') : parts.join('+');
    })
    .join(' ');
}

/** Shortcut label for a registry entry id. */
export function formatHotkeyId(
  hotkey: string | undefined,
  mac = isMacPlatform(),
): string {
  if (!hotkey) return '';
  return formatHotkey(hotkey, mac);
}
