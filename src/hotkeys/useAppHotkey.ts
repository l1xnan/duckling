import {
  useHotkey,
  type RegisterableHotkey,
  type UseHotkeyOptions,
} from '@tanstack/react-hotkeys';

import type { HotkeyId } from './registry';
import { useHotkeyBinding } from './resolve';

/**
 * Register a hotkey from the app registry by id (honors user overrides).
 * Pass `enabled: false` to keep registration but suppress firing.
 */
export function useAppHotkey(
  id: HotkeyId,
  callback: (event: KeyboardEvent) => void,
  options?: Omit<UseHotkeyOptions, 'hotkey'> & { enabled?: boolean },
) {
  const hotkey = useHotkeyBinding(id);
  // Registry / overrides store plain strings; TanStack types them as template-literal Hotkeys.
  useHotkey(
    hotkey as unknown as RegisterableHotkey,
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
