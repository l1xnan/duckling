import {
  useHotkey,
  type RegisterableHotkey,
  type UseHotkeyOptions,
} from '@tanstack/react-hotkeys';

import { HOTKEYS, type HotkeyId } from './registry';

/**
 * Register a hotkey from the app registry by id.
 * Pass `enabled: false` to keep registration but suppress firing.
 */
export function useAppHotkey(
  id: HotkeyId,
  callback: (event: KeyboardEvent) => void,
  options?: Omit<UseHotkeyOptions, 'hotkey'> & { enabled?: boolean },
) {
  const def = HOTKEYS[id];
  // Registry stores plain strings; TanStack types them as template-literal Hotkeys.
  useHotkey(
    def.hotkey as unknown as RegisterableHotkey,
    (event) => {
      callback(event as KeyboardEvent);
    },
    {
      preventDefault: true,
      ...options,
      enabled: options?.enabled ?? true,
    },
  );
}
