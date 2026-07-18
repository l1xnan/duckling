import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Dialog } from '@/components/custom/Dialog';
import { Button } from '@/components/ui/button';
import { DialogClose, DialogFooter } from '@/components/ui/dialog';
import {
  normalizeDialectConfig,
  stripSecrets,
} from '@/lib/connectionConfig';
import { DatabaseForm } from '@/pages/sidebar/dialog/DatabaseDialog.tsx';
import { DBType, DialectConfig, useDBListStore } from '@/stores/dbList';

export function ConfigDialog({
  ctx: db,
  ...props
}: React.ComponentProps<typeof Dialog> & { ctx?: DBType }) {
  const { t } = useLingui();
  const updateDBConfig = useDBListStore((state) => state.setDB);

  const form = useForm<DialectConfig>({
    // Do not echo secrets into the form; empty password = keep existing (backend).
    defaultValues: db?.config
      ? stripSecrets(normalizeDialectConfig(db.config))
      : undefined,
  });

  useEffect(() => {
    form.reset(
      db?.config ? stripSecrets(normalizeDialectConfig(db.config)) : undefined,
    );
  }, [db?.id, form]);

  async function handleSubmit(values: DialectConfig) {
    try {
      // setDB registers profile + secrets into backend memory/vault.
      await updateDBConfig(db!.id, values);
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

  return (
    <Dialog
      {...props}
      className="min-w-[800px] min-h-[500px]"
      title={db?.displayName ?? db?.id ?? ''}
    >
      <DatabaseForm form={form} handleSubmit={handleSubmit} isNew={false} />
      <DialogFooter>
        <DialogClose render={<Button variant="secondary"><Trans>Cancel</Trans></Button>}>
          
        </DialogClose>
        <Button type="submit" onClick={form.handleSubmit(handleSubmit)}>
          <Trans>Ok</Trans>
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
