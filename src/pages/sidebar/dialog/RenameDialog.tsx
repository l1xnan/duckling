import { useForm } from 'react-hook-form';

import Dialog from '@/components/custom/Dialog';
import { Button } from '@/components/ui/button';
import { DialogClose, DialogFooter } from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
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
    <Dialog open={props.open} onOpenChange={props.onOpenChange} title="Rename">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
              </FormItem>
            )}
          />

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button type="submit">Ok</Button>
          </DialogFooter>
        </form>
      </Form>
    </Dialog>
  );
});
