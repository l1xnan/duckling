import { Trans, useLingui } from '@lingui/react/macro';
import { useHotkeyRecorder } from '@tanstack/react-hotkeys';
import { RotateCcwIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { formatHotkey } from '@/hotkeys/format';
import {
  HOTKEY_CATEGORY_LABELS,
  HOTKEY_LIST,
  HOTKEYS,
  type HotkeyCategory,
  type HotkeyId,
} from '@/hotkeys/registry';
import {
  findEffectiveConflicts,
  getHotkey,
  isHotkeyOverridden,
  resetAllHotkeyOverrides,
  setHotkeyOverride,
} from '@/hotkeys/resolve';
import { cn } from '@/lib/utils';
import { useSettingStore } from '@/stores/setting';

const CATEGORY_ORDER: HotkeyCategory[] = [
  'general',
  'editor',
  'tabs',
  'tree',
];

export function HotkeysForm() {
  const { t } = useLingui();
  // Re-render when overrides change
  const overrides = useSettingStore((s) => s.hotkey_overrides);
  const [recordingId, setRecordingId] = useState<HotkeyId | null>(null);

  const conflicts = useMemo(
    () => findEffectiveConflicts(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [overrides],
  );

  const conflictIds = useMemo(() => {
    const set = new Set<HotkeyId>();
    for (const c of conflicts) {
      for (const id of c.ids) set.add(id);
    }
    return set;
  }, [conflicts]);

  const byCategory = CATEGORY_ORDER.map((cat) => ({
    cat,
    items: HOTKEY_LIST.filter((h) => h.category === cat),
  })).filter((g) => g.items.length > 0);

  const handleResetAll = () => {
    resetAllHotkeyOverrides();
    setRecordingId(null);
    toast.success(t`Shortcuts restored to defaults`);
  };

  return (
    <div className="flex min-h-0 h-full flex-col gap-4 overflow-hidden">
      <div className="shrink-0 space-y-1">
        <h3 className="text-sm font-semibold">
          <Trans>Keyboard shortcuts</Trans>
        </h3>
        <p className="text-xs text-muted-foreground">
          <Trans>
            Click a shortcut to record a new combination. Built-in editor and
            table shortcuts cannot be remapped here.
          </Trans>
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-auto pr-1">
        {byCategory.map(({ cat, items }) => (
          <section key={cat} className="mb-5">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t(HOTKEY_CATEGORY_LABELS[cat])}
            </h4>
            <ul className="flex flex-col gap-1 rounded-md border divide-y">
              {items.map((item) => (
                <HotkeyRow
                  key={item.id}
                  id={item.id}
                  recordingId={recordingId}
                  setRecordingId={setRecordingId}
                  hasConflict={conflictIds.has(item.id)}
                  overridden={isHotkeyOverridden(item.id)}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>

      {conflicts.length > 0 ? (
        <div className="shrink-0 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
          <Trans>
            Some shortcuts share the same keys within a scope. Resolve conflicts
            by reassigning one of them.
          </Trans>
        </div>
      ) : null}

      <div className="shrink-0 flex justify-end border-t pt-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleResetAll}
          disabled={!overrides || Object.keys(overrides).length === 0}
        >
          <RotateCcwIcon className="size-3.5" />
          <Trans>Reset all</Trans>
        </Button>
      </div>
    </div>
  );
}

function HotkeyRow({
  id,
  recordingId,
  setRecordingId,
  hasConflict,
  overridden,
}: {
  id: HotkeyId;
  recordingId: HotkeyId | null;
  setRecordingId: (id: HotkeyId | null) => void;
  hasConflict: boolean;
  overridden: boolean;
}) {
  const { t } = useLingui();
  const def = HOTKEYS[id];
  const binding = getHotkey(id);
  const isRecording = recordingId === id;
  const readOnly = !!def.displayOnly;

  const recorder = useHotkeyRecorder({
    // Capture keys even when focus is on the settings list button.
    ignoreInputs: false,
    onRecord: (hotkey) => {
      if (readOnly) return;
      const next = String(hotkey);
      // Reject empty (Backspace/Delete clear)
      if (!next.trim()) {
        setRecordingId(null);
        return;
      }
      setHotkeyOverride(id, next);
      setRecordingId(null);
      toast.success(t`Shortcut updated`);
    },
    onCancel: () => {
      setRecordingId(null);
    },
  });

  // Stop this row's recorder when another row becomes active.
  useEffect(() => {
    if (!isRecording && recorder.isRecording) {
      recorder.stopRecording();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording]);

  const display = isRecording
    ? recorder.recordedHotkey
      ? formatHotkey(String(recorder.recordedHotkey))
      : t`Press keys…`
    : formatHotkey(binding);

  const handleClick = () => {
    if (readOnly) {
      toast.message(
        t`This shortcut is built into the editor or table and cannot be changed.`,
      );
      return;
    }
    if (isRecording) {
      recorder.cancelRecording();
      setRecordingId(null);
      return;
    }
    setRecordingId(id);
    // Defer start so sibling rows can stop via isRecording flip.
    queueMicrotask(() => {
      recorder.startRecording();
    });
  };

  const handleReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRecording) {
      recorder.cancelRecording();
      setRecordingId(null);
    }
    setHotkeyOverride(id, null);
  };

  return (
    <li
      className={cn(
        'flex items-center justify-between gap-3 px-3 py-2 text-sm',
        hasConflict && 'bg-amber-500/10',
        isRecording && 'bg-primary/5 ring-1 ring-inset ring-primary/30',
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{t(def.label)}</div>
        {readOnly ? (
          <div className="text-[10px] text-muted-foreground">
            <Trans>Built-in</Trans>
          </div>
        ) : overridden ? (
          <div className="text-[10px] text-muted-foreground">
            <Trans>Custom</Trans>
            {' · '}
            <Trans>default: {formatHotkey(def.hotkey)}</Trans>
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {overridden && !readOnly ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            title={t`Reset to default`}
            onClick={handleReset}
          >
            <RotateCcwIcon className="size-3.5" />
          </Button>
        ) : null}
        <button
          type="button"
          onClick={handleClick}
          className={cn(
            'min-w-[7rem] rounded border px-2 py-1 font-mono text-[11px] tabular-nums',
            'hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            readOnly && 'cursor-default opacity-80',
            isRecording && 'border-primary text-primary',
            hasConflict && 'border-amber-500/60',
          )}
        >
          {display}
        </button>
      </div>
    </li>
  );
}
