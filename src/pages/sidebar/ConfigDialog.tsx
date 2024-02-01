import DialogContentText from '@mui/material/DialogContentText';
import TextField from '@mui/material/TextField';
import { useAtom, useAtomValue } from 'jotai';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { configAtom, dbMapAtom, useDBListStore } from '@/stores/dbList';

export default function ConfigDialog() {
  const updateCwd = useDBListStore((state) => state.setCwd);

  const dbMap = useAtomValue(dbMapAtom);

  const [context, setContext] = useAtom(configAtom);
  const dbId = context?.dbId ?? '';
  const db = dbMap.get(dbId);

  const handleSubmit = ({ cwd }) => {
    if (dbId) {
      updateCwd(cwd, dbId);
    }
    handClose();
  };

  const handClose = () => {
    setContext(null);
  };
  const form = useForm<{ cwd: string }>({
    defaultValues: { cwd: db?.cwd ?? '' },
  });

  return (
    <Dialog open={context != null} onOpenChange={handClose}>
      <DialogContent
        className="min-w-[600px]"
        onInteractOutside={(e) => {
          e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{db?.displayName ?? db?.id ?? ''}</DialogTitle>
        </DialogHeader>

        <DialogDescription>
          Set working directory for the read parquet relative path
        </DialogDescription>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-8"
          >
            <FormField
              control={form.control}
              name="cwd"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Working Directory</FormLabel>
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
      </DialogContent>
    </Dialog>
  );
}
