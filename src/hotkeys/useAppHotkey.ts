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
      // Multiple Editor tabs each register the same binding; only one is
      // typically `enabled`. Allow multi-registration without console noise.
      conflictBehavior: 'allow',
      ...options,
      enabled: options?.enabled ?? true,
    },
  );
}
