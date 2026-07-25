import { Trans, useLingui } from '@lingui/react/macro';
import { FolderOpenIcon, RefreshCwIcon, Trash2Icon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import {
  appendMemoryLog,
  clearMemoryLog,
  openDiagnosticsDir,
  readMemoryLogTail,
  type MemoryLogLine,
} from '@/api';
import { Button } from '@/components/custom/ui/button';
import { Label } from '@/components/custom/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/custom/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  collectAppMetrics,
  DEFAULT_MEMORY_DIAGNOSTICS_INTERVAL_SEC,
  resolveMemoryDiagnosticsIntervalSec,
} from '@/lib/memoryDiagnostics';
import { setSettings, useSettingStore } from '@/stores/setting';

const INTERVAL_OPTIONS = [15, 30, 60, 120] as const;

function formatMb(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return v.toFixed(1);
}

function formatTs(ts: string): string {
  try {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return ts;
    return d.toLocaleString();
  } catch {
    return ts;
  }
}

export function DiagnosticsPanel() {
  const { t } = useLingui();
  const enabled =
    useSettingStore((s) => s.memory_diagnostics?.enabled) === true;
  const intervalSec = useSettingStore((s) =>
    resolveMemoryDiagnosticsIntervalSec(s.memory_diagnostics?.interval_sec),
  );
  const [rows, setRows] = useState<MemoryLogLine[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const tail = await readMemoryLogTail(50);
      setRows(tail.slice().reverse());
    } catch (err) {
      console.warn('readMemoryLogTail failed', err);
      toast.error(t`Failed to read memory log`);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void refresh();
  }, [refresh, enabled]);

  const setEnabled = (next: boolean) => {
    setSettings((s) => ({
      memory_diagnostics: {
        ...s.memory_diagnostics,
        enabled: next,
        interval_sec:
          s.memory_diagnostics?.interval_sec ??
          DEFAULT_MEMORY_DIAGNOSTICS_INTERVAL_SEC,
      },
    }));
  };

  const setIntervalSec = (sec: number) => {
    setSettings((s) => ({
      memory_diagnostics: {
        ...s.memory_diagnostics,
        enabled: s.memory_diagnostics?.enabled ?? false,
        interval_sec: resolveMemoryDiagnosticsIntervalSec(sec),
      },
    }));
  };

  const sampleNow = async () => {
    try {
      await appendMemoryLog(collectAppMetrics());
      toast.success(t`Sample recorded`);
      await refresh();
    } catch (err) {
      console.warn('appendMemoryLog failed', err);
      toast.error(t`Failed to sample memory`);
    }
  };

  const clearLog = async () => {
    try {
      await clearMemoryLog();
      setRows([]);
      toast.success(t`Memory log cleared`);
    } catch (err) {
      console.warn('clearMemoryLog failed', err);
      toast.error(t`Failed to clear memory log`);
    }
  };

  const openDir = async () => {
    try {
      await openDiagnosticsDir();
    } catch (err) {
      console.warn('openDiagnosticsDir failed', err);
      toast.error(t`Failed to open diagnostics folder`);
    }
  };

  const latest = rows[0];

  return (
    <div className="flex min-h-0 h-full flex-col gap-4 overflow-hidden">
      <div className="space-y-1">
        <h3 className="text-sm font-medium">
          <Trans>Memory diagnostics</Trans>
        </h3>
        <p className="text-muted-foreground text-xs">
          <Trans>
            Samples process and app memory (result tabs, tables). Logs to app
            data diagnostics folder. No SQL or secrets are stored.
          </Trans>
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Switch
            id="mem-diag-enabled"
            checked={enabled}
            onCheckedChange={setEnabled}
          />
          <Label htmlFor="mem-diag-enabled">
            <Trans>Enable sampling</Trans>
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-muted-foreground whitespace-nowrap">
            <Trans>Interval</Trans>
          </Label>
          <Select
            value={String(intervalSec)}
            onValueChange={(v) => {
              if (v != null) setIntervalSec(Number(v));
            }}
            items={INTERVAL_OPTIONS.map((n) => ({
              value: String(n),
              label: `${n}s`,
            }))}
          >
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {INTERVAL_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)} label={`${n}s`}>
                    {`${n}s`}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={sampleNow}>
          <RefreshCwIcon className="size-3.5" />
          <Trans>Sample now</Trans>
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => void refresh()}
          disabled={loading}
        >
          <Trans>Refresh</Trans>
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={openDir}>
          <FolderOpenIcon className="size-3.5" />
          <Trans>Open folder</Trans>
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={clearLog}>
          <Trash2Icon className="size-3.5" />
          <Trans>Clear log</Trans>
        </Button>
      </div>

      {latest ? (
        <div className="bg-muted/40 grid grid-cols-2 gap-x-4 gap-y-1 rounded-md border p-3 text-xs sm:grid-cols-3">
          <div>
            <span className="text-muted-foreground">
              <Trans>Total WS</Trans>
            </span>
            <div className="font-mono">{formatMb(latest.totalWsMb)} MB</div>
          </div>
          <div>
            <span className="text-muted-foreground">
              <Trans>Duckling</Trans>
            </span>
            <div className="font-mono">
              {formatMb(latest.ducklingWsMb)} MB
            </div>
          </div>
          <div>
            <span className="text-muted-foreground">
              <Trans>WebView</Trans>
            </span>
            <div className="font-mono">
              {formatMb(latest.webviewWsMb)} MB ({latest.webviewCount})
            </div>
          </div>
          <div>
            <span className="text-muted-foreground">
              <Trans>Result tabs</Trans>
            </span>
            <div className="font-mono">{latest.resultTabs}</div>
          </div>
          <div>
            <span className="text-muted-foreground">
              <Trans>Result rows</Trans>
            </span>
            <div className="font-mono">{latest.resultRows}</div>
          </div>
          <div>
            <span className="text-muted-foreground">
              <Trans>Est. result</Trans>
            </span>
            <div className="font-mono">{latest.resultEstKb} KB</div>
          </div>
          <div>
            <span className="text-muted-foreground">
              <Trans>Main tabs</Trans>
            </span>
            <div className="font-mono">{latest.mainTabs}</div>
          </div>
          <div>
            <span className="text-muted-foreground">
              <Trans>Soft-closed editors</Trans>
            </span>
            <div className="font-mono">{latest.softClosedEditors}</div>
          </div>
          <div>
            <span className="text-muted-foreground">
              <Trans>DB sessions</Trans>
            </span>
            <div className="font-mono">{latest.dbSessions}</div>
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">
          <Trans>No samples yet. Enable sampling or click Sample now.</Trans>
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-auto rounded-md border">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/50 sticky top-0">
            <tr>
              <th className="px-2 py-1.5 font-medium">
                <Trans>Time</Trans>
              </th>
              <th className="px-2 py-1.5 font-medium">
                <Trans>Total</Trans>
              </th>
              <th className="px-2 py-1.5 font-medium">
                <Trans>WV</Trans>
              </th>
              <th className="px-2 py-1.5 font-medium">
                <Trans>Results</Trans>
              </th>
              <th className="px-2 py-1.5 font-medium">
                <Trans>Rows</Trans>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.ts}-${i}`} className="border-t">
                <td className="px-2 py-1 font-mono whitespace-nowrap">
                  {formatTs(r.ts)}
                </td>
                <td className="px-2 py-1 font-mono">
                  {formatMb(r.totalWsMb)}
                </td>
                <td className="px-2 py-1 font-mono">
                  {formatMb(r.webviewWsMb)}
                </td>
                <td className="px-2 py-1 font-mono">{r.resultTabs}</td>
                <td className="px-2 py-1 font-mono">{r.resultRows}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
