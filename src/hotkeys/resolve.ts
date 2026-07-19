import { useSettingStore } from '@/stores/setting';

import {
  HOTKEYS,
  HOTKEY_LIST,
  type HotkeyDef,
  type HotkeyId,
  type HotkeyScope,
} from './registry';

/** Default combo for a registry id. */
export function defaultHotkey(id: HotkeyId): string {
  return HOTKEYS[id].hotkey;
}

/** Read overrides from settings store (or empty). */
export function getHotkeyOverrides(): Record<string, string> {
  return useSettingStore.getState().hotkey_overrides ?? {};
}

/**
 * Resolved combo for an id: user override if non-empty, else registry default.
 * Alias: getHotkey
 */
export function resolveHotkey(
  id: HotkeyId,
  overrides?: Record<string, string> | null,
): string {
  const o = overrides ?? getHotkeyOverrides();
  const v = o[id]?.trim();
  return v || HOTKEYS[id].hotkey;
}

export const getHotkey = resolveHotkey;

/** Full def with resolved `hotkey` string. */
export function resolveHotkeyDef(
  id: HotkeyId,
  overrides?: Record<string, string> | null,
): HotkeyDef {
  const base = HOTKEYS[id];
  return { ...base, hotkey: resolveHotkey(id, overrides) };
}

export function resolveHotkeyList(
  overrides?: Record<string, string> | null,
): HotkeyDef[] {
  const o = overrides ?? getHotkeyOverrides();
  return HOTKEY_LIST.map((d) => ({
    ...d,
    hotkey: resolveHotkey(d.id, o),
  }));
}

export const getEffectiveHotkeyList = resolveHotkeyList;

/** Whether this id currently differs from the default. */
export function isHotkeyCustomized(
  id: HotkeyId,
  overrides?: Record<string, string> | null,
): boolean {
  const o = overrides ?? getHotkeyOverrides();
  const v = o[id]?.trim();
  return !!v && v !== HOTKEYS[id].hotkey;
}

export const isHotkeyOverridden = isHotkeyCustomized;

/**
 * Find conflicts among resolved bindings (same scope + same combo).
 */
export function findResolvedConflicts(
  overrides?: Record<string, string> | null,
): Array<{ hotkey: string; scope: HotkeyScope; ids: HotkeyId[] }> {
  const list = resolveHotkeyList(overrides);
  const map = new Map<string, HotkeyId[]>();
  for (const d of list) {
    const key = `${d.scope}::${d.hotkey.toLowerCase()}`;
    const ids = map.get(key) ?? [];
    ids.push(d.id);
    map.set(key, ids);
  }
  const out: Array<{ hotkey: string; scope: HotkeyScope; ids: HotkeyId[] }> =
    [];
  for (const [key, ids] of map) {
    if (ids.length > 1) {
      const [scope, hotkey] = key.split('::') as [HotkeyScope, string];
      out.push({ scope, hotkey, ids });
    }
  }
  return out;
}

export const findEffectiveConflicts = findResolvedConflicts;

export function setHotkeyOverride(id: HotkeyId, hotkey: string | null) {
  useSettingStore.setState((s) => {
    const prev = { ...(s.hotkey_overrides ?? {}) };
    const trimmed = hotkey?.trim() ?? '';
    if (!trimmed || trimmed === HOTKEYS[id].hotkey) {
      delete prev[id];
    } else {
      prev[id] = trimmed;
    }
    return { hotkey_overrides: prev };
  });
}

export function resetAllHotkeyOverrides() {
  useSettingStore.setState({ hotkey_overrides: {} });
}

/** React hook: subscribe to resolved combo for an id. */
export function useResolvedHotkey(id: HotkeyId): string {
  const override = useSettingStore((s) => s.hotkey_overrides?.[id]);
  return override?.trim() || HOTKEYS[id].hotkey;
}

export const useHotkeyBinding = useResolvedHotkey;

export function useHotkeyOverrides(): Record<string, string> {
  return useSettingStore((s) => s.hotkey_overrides ?? {});
}
