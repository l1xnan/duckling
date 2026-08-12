import { Trans, useLingui } from '@lingui/react/macro';
import { nanoid } from 'nanoid';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import Dialog from '@/components/custom/Dialog';
import { Button } from '@/components/custom/ui/button';
import { Input } from '@/components/custom/ui/input';
import { Label } from '@/components/custom/ui/label';
import {
  type ComputedColumn,
  validateComputedColumns,
} from '@/lib/sql/computedColumns';

export type ComputedColumnsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: ComputedColumn[];
  onApply: (columns: ComputedColumn[]) => void;
};

type DraftRow = ComputedColumn;

function emptyRow(): DraftRow {
  return { id: nanoid(), sql: '' };
}

export function ComputedColumnsDialog({
  open,
  onOpenChange,
  columns,
  onApply,
}: ComputedColumnsDialogProps) {
  const { t } = useLingui();
  const [rows, setRows] = useState<DraftRow[]>([]);

  useEffect(() => {
    if (!open) return;
    setRows(columns.length > 0 ? columns.map((c) => ({ ...c })) : [emptyRow()]);
  }, [open, columns]);

  const handleAdd = () => {
    setRows((prev) => [...prev, emptyRow()]);
  };

  const handleRemove = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleApply = () => {
    const trimmed = rows
      .map((r) => ({ ...r, sql: r.sql.trim() }))
      .filter((r) => r.sql.length > 0);

    const err = validateComputedColumns(trimmed);
    if (err) {
      toast.error(err);
      return;
    }

    onApply(trimmed);
    onOpenChange(false);
  };

  const handleClear = () => {
    onApply([]);
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={<Trans>Computed columns</Trans>}
      className="min-w-[560px] max-w-[min(90vw,40rem)]"
    >
      <div className="flex min-h-0 flex-col gap-4">
        <p className="text-sm text-muted-foreground">
                  <Trans>
                    Add SQL select items with an alias, for example{' '}
                    <code className="text-xs">a + 1 AS a1</code>. Filtering follows
                    your database’s SQL rules: aliases are often unavailable in WHERE
                    (use the full expression); ORDER BY may accept aliases depending on
                    the dialect.
                  </Trans>
        </p>
        <div className="space-y-3 max-h-[min(50vh,320px)] overflow-y-auto pr-1">
          {rows.map((row, index) => (
            <div key={row.id} className="flex items-start gap-2">
              <div className="min-w-0 flex-1 space-y-1">
                <Label className="sr-only">
                  <Trans>Computed column {index + 1}</Trans>
                </Label>
                <Input
                  value={row.sql}
                  onChange={(e) => {
                    const value = e.target.value;
                    setRows((prev) =>
                      prev.map((r) => (r.id === row.id ? { ...r, sql: value } : r)),
                    );
                  }}
                  placeholder={t`a + 1 AS a1`}
                  className="font-mono text-sm"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0"
                disabled={rows.length <= 1 && !row.sql.trim()}
                onClick={() => handleRemove(row.id)}
                aria-label={t`Remove computed column`}
              >
                <Trash2Icon className="size-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" className="w-fit" onClick={handleAdd}>
          <PlusIcon className="size-4" />
          <Trans>Add column</Trans>
        </Button>
        <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            <Trans>Cancel</Trans>
          </Button>
          {columns.length > 0 ? (
            <Button type="button" variant="outline" onClick={handleClear}>
              <Trans>Clear all</Trans>
            </Button>
          ) : null}
          <Button type="button" onClick={handleApply}>
            <Trans>Apply</Trans>
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
