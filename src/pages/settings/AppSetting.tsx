import SettingsIcon from '@mui/icons-material/Settings';
import { DialogClose } from '@radix-ui/react-dialog';
import * as React from 'react';
import { useForm } from 'react-hook-form';

import { MuiIconButton } from '@/components/MuiIconButton';
import Dialog from '@/components/custom/Dialog';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { SettingState, useSettingStore } from '@/stores/setting';

export default function AppSettingDialog() {
  const setStore = useSettingStore((state) => state.setStore);
  const precision = useSettingStore((state) => state.precision);
  const table_font_family = useSettingStore((state) => state.table_font_family);
  const form = useForm({
    defaultValues: {
      table_font_family,
      precision,
    },
  });

  const onSubmit = (data: SettingState) => {
    setStore(data);
    console.log(data);
  };

  return (
    <React.Fragment>
      <Dialog
        title="Setting"
        trigger={
          <MuiIconButton>
            <SettingsIcon fontSize="inherit" />
          </MuiIconButton>
        }
      >
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="precision"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Float precision</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="table_font_family"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Table Font Family</FormLabel>
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
    </React.Fragment>
  );
}
