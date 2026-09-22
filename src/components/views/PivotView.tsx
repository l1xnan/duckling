import { PivotWorkbench } from '@/components/views/PivotWorkbench';
import type { PivotContextType } from '@/stores/tabs';

export function PivotView({ context }: { context: PivotContextType }) {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden p-3">
      <PivotWorkbench
        mode="tab"
        tabId={context.id}
        columns={context.columns ?? []}
        dbId={context.dbId}
        sourceKind={context.sourceKind}
        tableType={context.tableType}
        tableId={context.tableId}
        tableName={context.tableName}
        schema={context.schema}
        sourceSql={context.sourceSql}
        sqlWhere={context.sqlWhere}
        computedColumns={context.computedColumns}
        beautify={context.beautify ?? true}
        initialRows={context.pivotRows}
        initialColumns={context.pivotColumns}
        initialMeasures={context.pivotMeasures}
        initialShowAs={context.showAs}
        sourceTabId={context.sourceTabId}
        lastSql={context.lastSql}
      />
    </div>
  );
}
