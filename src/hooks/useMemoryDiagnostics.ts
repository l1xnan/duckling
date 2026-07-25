import { useEffect, useRef } from 'react';

import { appendMemoryLog } from '@/api';
import {
  collectAppMetrics,
  resolveMemoryDiagnosticsIntervalSec,
} from '@/lib/memoryDiagnostics';
import { useSettingStore } from '@/stores/setting';

/**
 * When memory diagnostics is enabled in settings, periodically sample
 * process + app metrics and append to app_data/diagnostics/memory.jsonl.
 */
export function useMemoryDiagnostics() {
  const enabled = useSettingStore((s) => s.memory_diagnostics?.enabled === true);
  const intervalSec = useSettingStore((s) =>
    resolveMemoryDiagnosticsIntervalSec(s.memory_diagnostics?.interval_sec),
  );
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (!enabled) {
      return;
    }

    const sample = () => {
      if (inFlightRef.current) {
        return;
      }
      inFlightRef.current = true;
      const metrics = collectAppMetrics();
      void appendMemoryLog(metrics)
        .catch((err) => {
          console.warn('memory diagnostics sample failed', err);
        })
        .finally(() => {
          inFlightRef.current = false;
        });
    };

    sample();
    timerRef.current = setInterval(sample, intervalSec * 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [enabled, intervalSec]);
}
