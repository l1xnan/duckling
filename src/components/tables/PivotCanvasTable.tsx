import { PivotTable } from '@visactor/react-vtable';
import type {
  PivotTable as PivotTableAPI,
  PivotTableConstructorOptions,
} from '@visactor/vtable';
import { useMemo, useRef } from 'react';

import {
  applyPivotShowAs,
  formatPivotPercent,
  measureAlias,
  measureTitle,
  type PivotConfig,
  type PivotShowAs,
} from '@/lib/sql/pivot';

import { useResolvedColorTheme } from '@/hooks/use-color-theme';
import { useTableFontFamily, useTableFontSize } from '@/stores/setting';

import { makeTableTheme } from './theme';

export type PivotCanvasTableProps = {
  records: Record<string, unknown>[];
  config: Pick<PivotConfig, 'rows' | 'columns' | 'measures'>;
  showAs?: PivotShowAs;
  className?: string;
};

function useTableTheme() {
  const { isDark, tokens } = useResolvedColorTheme();
  const tableFontFamily = useTableFontFamily();
  const tableFontSize = useTableFontSize();
  return useMemo(
    () =>
      makeTableTheme({
        isDark,
        tokens,
        tableFontFamily,
        tableFontSize,
      }),
    [isDark, tokens, tableFontFamily, tableFontSize],
  );
}

export function PivotCanvasTable({
  records,
  config,
  showAs = 'value',
  className,
}: PivotCanvasTableProps) {
  const tableRef = useRef<PivotTableAPI>(null);
  const theme = useTableTheme();
  const isPercent = showAs !== 'value';

  const displayRecords = useMemo(
    () => applyPivotShowAs(records, config, showAs),
    [records, config, showAs],
  );

  const option: PivotTableConstructorOptions = useMemo(() => {
    const rows = (config.rows ?? []).map((f) => ({
      dimensionKey: f,
      title: f,
      width: 'auto' as const,
    }));
    const columns = (config.columns ?? []).map((f) => ({
      dimensionKey: f,
      title: f,
      width: 'auto' as const,
    }));
    const indicators = (config.measures ?? []).map((m) => {
      const key = measureAlias(m);
      return {
        indicatorKey: key,
        title: measureTitle(m),
        width: 'auto' as const,
        sort: true,
        ...(isPercent
          ? {
              format: (value: unknown) => {
                if (value == null || value === '') return '';
                const n =
                  typeof value === 'number'
                    ? value
                    : typeof value === 'bigint'
                      ? Number(value)
                      : Number(value);
                if (!Number.isFinite(n)) return String(value);
                return formatPivotPercent(n, 100);
              },
            }
          : {}),
      };
    });

    return {
      records: displayRecords,
      rows,
      columns,
      indicators,
      indicatorsAsCol: true,
      corner: { titleOnDimension: 'row' },
      hideIndicatorName: false,
      widthMode: 'autoWidth',
      heightMode: 'standard',
      defaultRowHeight: 24,
      defaultHeaderRowHeight: 28,
      limitMaxAutoWidth: 200,
      theme,
      hover: {
        highlightMode: 'cell',
      },
      keyboardOptions: {
        copySelected: true,
      },
    };
  }, [
    displayRecords,
    config.rows,
    config.columns,
    config.measures,
    isPercent,
    theme,
  ]);

  if (!records.length) {
    return null;
  }

  return (
    <div className={className ?? 'h-full w-full min-h-0'}>
      <PivotTable
        ref={tableRef as never}
        option={option}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}
