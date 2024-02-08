import { IconDatabasePlus } from '@tabler/icons-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { getDB } from '@/api';
import { MuiIconButton } from '@/components/MuiIconButton';
import Dialog from '@/components/custom/Dialog';
import { Button } from '@/components/ui/button';
import { DialogClose, DialogFooter } from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DialectConfig, useDBListStore } from '@/stores/dbList';

export function DatabaseDialog() {
  const [open, setOpen] = useState(false);
  const form = useForm<DialectConfig>();
  const appendDB = useDBListStore((state) => state.append);

  async function onSubmit(values: DialectConfig) {
    const data = await getDB({ ...values });
    appendDB(data);
    setOpen(false);
  }
  const watchDialect = form.watch('dialect');

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title="New Connection"
      trigger={
        <MuiIconButton>
          <IconDatabasePlus />
        </MuiIconButton>
      }
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <FormField
            control={form.control}
            name="dialect"
            render={({ field }) => (
              <FormItem className="flex items-center w-[62.5%]">
                <FormLabel className="w-1/5 mr-2 mt-2">Dialect</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  {...field}
                >
                  <FormControl className="w-4/5">
                    <SelectTrigger>
                      <SelectValue placeholder="Select a dialect" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="duckdb">DuckDB</SelectItem>
                    <SelectItem value="clickhouse">Clickhouse</SelectItem>
                    <SelectItem value="sqlite">SQLite</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
          {watchDialect == 'clickhouse' ? (
            <>
              <div className="flex">
                <FormField
                  control={form.control}
                  name="host"
                  render={({ field }) => (
                    <FormItem className="flex items-center w-[62.5%]">
                      <FormLabel className="w-1/5 mr-2 mt-2">Host</FormLabel>
                      <FormControl className="w-4/5">
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="port"
                  render={({ field }) => (
                    <FormItem className="flex items-center w-[37.5%]">
                      <FormLabel className="w-1/3 mr-2 text-right mt-2">
                        Port
                      </FormLabel>
                      <FormControl className="w-2/3">
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="database"
                render={({ field }) => (
                  <FormItem className="flex items-center w-[62.5%]">
                    <FormLabel className="w-1/5 mr-2 mt-2">Database</FormLabel>
                    <FormControl className="w-4/5">
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem className="flex items-center w-[62.5%]">
                    <FormLabel className="w-1/5 mr-2 mt-2">Username</FormLabel>
                    <FormControl className="w-4/5">
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem className="flex items-center w-[62.5%]">
                    <FormLabel className="w-1/5 mr-2 mt-2">Password</FormLabel>
                    <FormControl className="w-4/5">
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          ) : null}
          {watchDialect == 'duckdb' || watchDialect == 'sqlite' ? (
            <>
              <FormField
                control={form.control}
                name="path"
                render={({ field }) => (
                  <FormItem className="flex items-center w-[62.5%]">
                    <FormLabel className="w-1/5 mr-2 mt-2">Path</FormLabel>
                    <FormControl className="w-4/5">
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cwd"
                render={({ field }) => (
                  <FormItem className="flex items-center w-[62.5%]">
                    <FormLabel className="w-1/5 mr-2 mt-2">Work Path</FormLabel>
                    <FormControl className="w-4/5">
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          ) : null}
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
}
