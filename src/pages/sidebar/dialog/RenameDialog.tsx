import { Trans } from '@lingui/react/macro';
import { useForm } from 'react-hook-form';

import Dialog from '@/components/custom/Dialog';
import { Button } from '@/components/custom/ui/button';
import { DialogClose, DialogFooter } from '@/components/custom/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/custom/ui/form';
import { Input } from '@/components/custom/ui/input';
import { DBType, useDBListStore } from '@/stores/dbList';
import React, { useEffect } from 'react';

type DialogProps = React.ComponentProps<typeof Dialog>;

// rename db
export const RenameDialog = React.memo(function RenameDialog(
  props: DialogProps & { ctx: DBType },
) {
  const rename = useDBListStore((s) => s.rename);

  const db = props.ctx;
  const handleSubmit = ({ name }: { name: string }) => {
    rename(db!.id, name);
    props.onOpenChange?.(false);
  };

  const form = useForm<{ name: string }>({
    defaultValues: { name: db?.displayName },
  });

  useEffect(() => {
    form.reset();
    form.setValue('name', db?.displayName);
  }, [props.open]);

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange} title={<Trans>Rename</Trans>}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Name</Trans>
                </FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
              </FormItem>
            )}
          />

          <DialogFooter>
        <DialogClose render={ <Button variant="secondary"><Trans>Cancel</Trans></Button>}>
            </DialogClose>
            <Button type="submit">
              <Trans>Ok</Trans>
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </Dialog>
  );
});
