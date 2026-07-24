import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useMemo, useState } from 'react';

import Dialog from '@/components/custom/Dialog';
import { Button } from '@/components/custom/ui/button';
import { Label } from '@/components/custom/ui/label';
import { Textarea } from '@/components/custom/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

export type MacroRunSubmit = {
  values: Record<string, string[]>;
  writeVars: boolean;
};

export type MacroRunDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** All placeholders in the template (display order). */
  placeholders: string[];
  /** Variables still needing values (subset of placeholders). */
  missing: string[];
  /** Values already provided by @vars (prefill, read-only summary). */
  provided: Record<string, string[]>;
  /** Prefill from last session for missing keys. */
  remembered?: Record<string, string[]>;
  /** Default for "write @vars" checkbox (remembered per editor tab). */
  defaultWriteVars?: boolean;
  onSubmit: (result: MacroRunSubmit) => void;
};

function linesToValues(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

function valuesToText(values: string[] | undefined): string {
  return (values ?? []).join('\n');
}

export function MacroRunDialog({
  open,
  onOpenChange,
  placeholders,
  missing,
  provided,
  remembered,
  defaultWriteVars = true,
  onSubmit,
}: MacroRunDialogProps) {
  const { t } = useLingui();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [writeVars, setWriteVars] = useState(defaultWriteVars);
  const [error, setError] = useState<string | null>(null);

  const missingSet = useMemo(() => new Set(missing), [missing]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const next: Record<string, string> = {};
    for (const name of missing) {
      const fromRemember = remembered?.[name];
      const fromProvided = provided[name];
      next[name] = valuesToText(fromRemember ?? fromProvided);
    }
    setDrafts(next);
    setWriteVars(defaultWriteVars);
    setError(null);
  }, [open, missing, provided, remembered, defaultWriteVars]);

  const comboHint = useMemo(() => {
    let n = 1;
    for (const name of placeholders) {
      if (missingSet.has(name)) {
        const count = Math.max(1, linesToValues(drafts[name] ?? '').length);
        n *= count;
      } else {
        const count = Math.max(1, (provided[name] ?? []).length);
        n *= count;
      }
    }
    return n;
  }, [placeholders, missingSet, drafts, provided]);

  const handleRun = () => {
    const values: Record<string, string[]> = {};
    for (const name of missing) {
      const list = linesToValues(drafts[name] ?? '');
      if (list.length === 0) {
        setError(t`Variable "${name}" requires at least one value`);
        return;
      }
      values[name] = list;
    }
    setError(null);
    onSubmit({ values, writeVars });
  };

  const providedEntries = useMemo(
    () =>
      Object.entries(provided).filter(
        ([k]) => !missingSet.has(k) && placeholders.includes(k),
      ),
    [provided, missingSet, placeholders],
  );

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={<Trans>Run with variables</Trans>}
      className="sm:max-w-lg"
    >
      <div className="flex min-h-0 flex-col gap-3 overflow-y-auto py-2">
        <p className="text-muted-foreground text-xs">
          <Trans>
            One value per line. Multiple lines run the query once per value
            (cartesian product when several variables have multiple values).
          </Trans>
        </p>

        {providedEntries.length > 0 ? (
          <div className="bg-muted/40 rounded-md border px-3 py-2 text-xs">
            <div className="text-muted-foreground mb-1 font-medium">
              <Trans>From @vars comment</Trans>
            </div>
            <ul className="space-y-0.5 font-mono">
              {providedEntries.map(([k, v]) => (
                <li key={k}>
                  <span className="text-foreground">{k}</span>
                  <span className="text-muted-foreground"> = </span>
                  <span>{v.join(', ')}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {missing.map((name) => (
          <div key={name} className="flex flex-col gap-1.5">
            <Label htmlFor={`macro-${name}`} className="font-mono text-sm">
              {`{{ ${name} }}`}
            </Label>
            <Textarea
              id={`macro-${name}`}
              value={drafts[name] ?? ''}
              onChange={(e) =>
                setDrafts((prev) => ({ ...prev, [name]: e.target.value }))
              }
              rows={Math.min(
                6,
                Math.max(2, (drafts[name] ?? '').split('\n').length),
              )}
              className={cn('font-mono text-sm')}
              placeholder={t`One value per line`}
            />
          </div>
        ))}

        <div className="flex items-center gap-2">
          <Checkbox
            id="macro-write-vars"
            checked={writeVars}
            onCheckedChange={(value) => setWriteVars(!!value)}
          />
          <Label htmlFor="macro-write-vars" className="text-xs font-normal">
            <Trans>Save values as @vars comment above SQL</Trans>
          </Label>
        </div>

        {error ? (
          <p className="text-destructive text-xs">{error}</p>
        ) : null}

        <p className="text-muted-foreground text-xs">
          <Trans>Will run {comboHint} time(s)</Trans>
        </p>
      </div>

      <div className="flex shrink-0 justify-end gap-2 border-t pt-3">
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          <Trans>Cancel</Trans>
        </Button>
        <Button onClick={handleRun}>
          <Trans>Run</Trans>
        </Button>
      </div>
    </Dialog>
  );
}
