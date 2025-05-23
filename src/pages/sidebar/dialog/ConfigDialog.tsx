import { useForm } from 'react-hook-form';

import { Dialog } from '@/components/custom/Dialog';
import { Button } from '@/components/ui/button';
import { DialogClose, DialogFooter } from '@/components/ui/dialog';
import { DatabaseForm } from '@/pages/sidebar/dialog/DatabaseDialog.tsx';
import { DBType, DialectConfig, useDBListStore } from '@/stores/dbList';
import { DialogProps } from '@radix-ui/react-dialog';
import { useEffect } from 'react';

export function ConfigDialog({
  ctx: db,
  ...props
}: DialogProps & { ctx?: DBType }) {
  const updateDBConfig = useDBListStore((state) => state.setDB);

  const form = useForm<DialectConfig>({
    defaultValues: db?.config,
  });

  useEffect(() => {
    form.reset();
  }, [db?.id, form]);

  async function handleSubmit(values: DialectConfig) {
    updateDBConfig(db!.id, values);
    props.onOpenChange?.(false);
  }

  return (
    <Dialog
      {...props}
      className="min-w-[800px] min-h-[500px]"
      title={db?.displayName ?? db?.id ?? ''}
    >
      <DatabaseForm form={form} handleSubmit={handleSubmit} isNew={false} />
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="secondary">Cancel</Button>
        </DialogClose>
        <Button type="submit" onClick={form.handleSubmit(handleSubmit)}>
          Ok
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
