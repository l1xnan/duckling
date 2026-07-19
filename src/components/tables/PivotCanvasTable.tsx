import { PivotTable } from '@visactor/react-vtable';
import type {
  PivotTable as PivotTableAPI,
  PivotTableConstructorOptions,
} from '@visactor/vtable';
import { useMemo, useRef } from 'react';

import { measureAlias, measureTitle, type PivotConfig } from '@/lib/sql/pivot';

import { useTheme } from '@/hooks/theme-provider';
import { useTableFontFamily, useTableFontSize } from '@/stores/setting';
import { isDarkTheme } from '@/utils';

import { makeTableTheme } from './theme';

export type PivotCanvasTableProps = {
  records: Record<string, unknown>[];
  config: Pick<PivotConfig, 'rows' | 'columns' | 'measures'>;
  className?: string;
};

function useTableTheme() {
  const appTheme = useTheme();
  const isDark = isDarkTheme(appTheme);
  const tableFontFamily = useTableFontFamily();
  const tableFontSize = useTableFontSize();
  return useMemo(
    () => makeTableTheme(isDark, tableFontFamily, tableFontSize),
    [isDark, tableFontFamily, tableFontSize],
  );
}

export function PivotCanvasTable({
  records,
  config,
  className,
}: PivotCanvasTableProps) {
  const tableRef = useRef<PivotTableAPI>(null);
  const theme = useTableTheme();

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
      };
    });

    return {
      records,
      rows,
      columns,
      indicators,
      indicatorsAsCol: true,
      corner: { titleOnDimension: 'row' },
      hideIndicatorName: indicators.length === 1,
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
  }, [records, config.rows, config.columns, config.measures, theme]);

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
