import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { listDatabases } from '@/api';
import { Dialog } from '@/components/custom/Dialog';
import { Button } from '@/components/custom/ui/button';
import { DialogClose, DialogFooter } from '@/components/custom/ui/dialog';
import {
  normalizeDialectConfig,
  stripSecrets,
} from '@/lib/connectionConfig';
import {
  ConnectionFormValues,
  DatabaseForm,
  resolveConnectionDisplayName,
  runConnectionTest,
  toDialectConfig,
} from '@/pages/sidebar/dialog/DatabaseDialog.tsx';
import { DBType, useDBListStore } from '@/stores/dbList';

export function ConfigDialog({
  ctx: db,
  ...props
}: Omit<React.ComponentProps<typeof Dialog>, 'title' | 'children'> & { ctx?: DBType }) {
  const { t } = useLingui();
  const [testing, setTesting] = useState(false);
  const [availableDatabases, setAvailableDatabases] = useState<string[]>(
    db?.meta ? Object.keys(db.meta) : [],
  );
  const updateDBConfig = useDBListStore((state) => state.setDB);
  const rename = useDBListStore((state) => state.rename);

  const form = useForm<ConnectionFormValues>({
    // Do not echo secrets into the form; empty password = keep existing (backend).
    defaultValues: db?.config
      ? {
          ...stripSecrets(normalizeDialectConfig(db.config)),
          displayName: db.displayName,
          visibleDatabases: db.visibleDatabases,
        }
      : undefined,
  });

  useEffect(() => {
    form.reset(
      db?.config
        ? {
            ...stripSecrets(normalizeDialectConfig(db.config)),
            displayName: db.displayName,
            visibleDatabases: db.visibleDatabases,
          }
        : undefined,
    );
  }, [db?.id, db?.displayName, db?.visibleDatabases, form]);

  async function handleSubmit(values: ConnectionFormValues) {
    try {
      const config = toDialectConfig(values);
      // setDB registers profile + secrets into backend memory/vault.
      await updateDBConfig(db!.id, config);
      const nextName = resolveConnectionDisplayName(values);
      if (nextName && nextName !== db!.displayName) {
        rename(db!.id, nextName);
      }
      // Save visibleDatabases filter
      if (values.visibleDatabases !== undefined) {
        useDBListStore.getState().update(db!.id, {
          visibleDatabases: values.visibleDatabases,
        });
      }
      props.onOpenChange?.(false);
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error
          ? error.message
          : t`Failed to save connection secrets`,
      );
    }
  }

  async function handleTest() {
    const values = form.getValues();
    if (!values.dialect) {
      toast.error(t`Select a dialect first`);
      return;
    }
    setTesting(true);
    try {
      await runConnectionTest(values, { connectionId: db?.id });
      toast.success(t`Connection successful`);
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : t`Connection failed`,
      );
    } finally {
      setTesting(false);
    }
  }

  async function handleRefreshDatabases() {
    const values = form.getValues();
    if (!values.dialect || !db?.id) {
      return;
    }
    try {
      const databases = await listDatabases(toDialectConfig(values), db.id);
      // Merge with existing visibleDatabases to preserve previously selected ones
      const currentVisible = form.getValues('visibleDatabases') ?? [];
      const merged = [...new Set([...databases, ...currentVisible])].sort((a, b) => a.localeCompare(b));
      setAvailableDatabases(merged);
      // If no visibleDatabases set, select all by default
      if (!form.getValues('visibleDatabases') && databases.length > 0) {
        form.setValue('visibleDatabases', databases);
      }
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : t`Failed to refresh databases`,
      );
    }
  }

  return (
    <Dialog
      {...props}
      className="min-w-[800px] min-h-[500px]"
      title={db?.displayName ?? db?.id ?? ''}
    >
      <DatabaseForm form={form} handleSubmit={handleSubmit} isNew={false} availableDatabases={availableDatabases} onRefreshDatabases={handleRefreshDatabases} />
      <DialogFooter>
        <DialogClose render={<Button variant="secondary"><Trans>Cancel</Trans></Button>}>
          
        </DialogClose>
        <Button
          type="button"
          variant="outline"
          disabled={testing}
          onClick={() => void handleTest()}
        >
          {testing ? <Trans>Testing…</Trans> : <Trans>Test Connection</Trans>}
        </Button>
        <Button type="submit" onClick={form.handleSubmit(handleSubmit)}>
          <Trans>Ok</Trans>
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
