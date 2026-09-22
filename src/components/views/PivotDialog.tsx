import { msg } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { useMemo } from 'react';

import Dialog from '@/components/custom/Dialog';
import { PivotWorkbench } from '@/components/views/PivotWorkbench';
import { columnsFromSchema } from '@/lib/pivot/openPivotTab';
import type { ComputedColumn } from '@/lib/sql/computedColumns';
import type { SchemaType } from '@/stores/dataset';
import type { TableContextType } from '@/stores/tabs';

export type PivotDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: SchemaType[];
  /** Table browse source. */
  context?: TableContextType;
  sqlWhere?: string;
  computedColumns?: ComputedColumn[];
  /** Query result source (subquery). */
  dbId?: string;
  sourceSql?: string;
  /** Prefill a row dimension when opening from a column menu. */
  initialRowField?: string;
  beautify?: boolean;
  /** Workspace tab to jump back to from a converted pivot tab. */
  sourceTabId?: string;
};

export function PivotDialog({
  open,
  onOpenChange,
  columns,
  context,
  sqlWhere,
  computedColumns,
  dbId,
  sourceSql,
  initialRowField,
  beautify = true,
  sourceTabId,
}: PivotDialogProps) {
  const snapshots = useMemo(() => columnsFromSchema(columns), [columns]);
  const pref = initialRowField?.trim();
  const initialRows =
    pref && snapshots.some((c) => c.name === pref) ? [pref] : [];
  const sourceKind: 'table' | 'subquery' =
    sourceSql?.trim() && dbId ? 'subquery' : 'table';

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={<Trans>Pivot table</Trans>}
      className="min-w-[min(960px,95vw)] h-[min(720px,92vh)] max-h-[min(720px,92vh)]"
    >
      {open ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden pt-2">
          <PivotWorkbench
            key={`${sourceTabId ?? ''}:${pref ?? ''}`}
            mode="dialog"
            columns={snapshots}
            schemaColumns={columns}
            dbId={dbId ?? context?.dbId}
            sourceKind={sourceKind}
            tableContext={context}
            sourceSql={sourceSql}
            sqlWhere={sqlWhere}
            computedColumns={computedColumns}
            beautify={beautify}
            initialRows={initialRows}
            sourceTabId={sourceTabId}
            onOpenedInTab={() => onOpenChange(false)}
          />
        </div>
      ) : null}
    </Dialog>
  );
}

void msg`Pivot table`;
void msg`Show as`;
void msg`Values`;
void msg`% of row`;
void msg`% of column`;
void msg`Open in tab`;
void msg`Go to source`;
void msg`Copy pivot SQL`;
void msg`Pivot`;
void msg`Pivot: query`;
