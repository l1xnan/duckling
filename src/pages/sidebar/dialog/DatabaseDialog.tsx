import { IconDatabasePlus } from '@tabler/icons-react';
import * as dialog from '@tauri-apps/plugin-dialog';
import { useState } from 'react';
import { useForm, UseFormReturn } from 'react-hook-form';

import { Dialog } from '@/components/custom/Dialog';
import { TooltipButton } from '@/components/custom/button';
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
import { TreeNode } from '@/types';
import { nanoid } from 'nanoid';

type DatabaseFormProps = {
  form: UseFormReturn<DialectConfig>;
  handleSubmit: (values: DialectConfig) => Promise<void>;
  isNew?: boolean;
};

export function DatabaseForm({
  form,
  handleSubmit,
  isNew = true,
}: DatabaseFormProps) {
  const watchDialect = form.watch('dialect');

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="flex flex-col"
      >
        <div className="flex-1 space-y-4">
          <FormField
            control={form.control}
            name="dialect"
            render={({ field }) => (
              <FormItem className="flex items-center w-[62.5%]">
                <FormLabel className="w-1/5 mr-2 mt-2">Dialect</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  disabled={!isNew}
                  {...field}
                >
                  <FormControl className="w-4/5">
                    <SelectTrigger>
                      <SelectValue placeholder="Select a dialect" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="duckdb">DuckDB</SelectItem>
                    <SelectItem value="folder">Data Folder</SelectItem>
                    <SelectItem value="sqlite">SQLite</SelectItem>
                    <SelectItem value="mysql">MySQL</SelectItem>
                    <SelectItem value="postgres">Postgres</SelectItem>
                    <SelectItem value="clickhouse">Clickhouse</SelectItem>
                    <SelectItem value="clickhouse_tcp">
                      Clickhouse(TCP)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
          {watchDialect == 'clickhouse_tcp' ||
          watchDialect == 'clickhouse' ||
          watchDialect == 'mysql' ||
          watchDialect == 'postgres' ? (
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
                      {/* <FormLabel className="w-1/3 ml-2 text-right mt-2"> */}
                      <FormLabel className="ml-4">Port</FormLabel>
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
          {watchDialect == 'duckdb' ||
          watchDialect == 'sqlite' ||
          watchDialect == 'folder' ? (
            <>
              <FormField
                control={form.control}
                name="path"
                render={({ field }) => (
                  <FormItem className="flex items-center w-[62.5%]">
                    <FormLabel className="w-1/5 mr-2 mt-2">Path</FormLabel>
                    <FormControl className="w-4/5">
                      <div className="flex w-full max-w-sm items-center gap-1">
                        <Input {...field} />
                        <Button
                          variant="outline"
                          onClick={async (e) => {
                            e.preventDefault();
                            const file = await dialog.open({
                              multiple: false,
                              directory:
                                watchDialect == 'folder',
                            });
                            if (file) {
                              form.setValue('path', file);
                            }
                          }}
                        >
                          Open
                        </Button>
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />
            </>
          ) : null}
          {watchDialect == 'duckdb' ? (
            <>
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
        </div>
      </form>
    </Form>
  );
}

export function DatabaseDialog() {
  const [open, setOpen] = useState(false);
  const form = useForm<DialectConfig>();
  const appendDB = useDBListStore((state) => state.append);
  const updateDB = useDBListStore((state) => state.updateByConfig);

  async function handleSubmit(values: DialectConfig) {
    const initData = {
      id: nanoid(),
      dialect: values.dialect,
      config: values,
      displayName: (values as any).path ?? (values as any).host,
      data: {} as TreeNode,
      loading: true,
    };
    appendDB(initData);
    setOpen(false);
    updateDB(initData.id, values);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title="New Connection"
      className="min-w-[800px] min-h-[500px]"
      trigger={<TooltipButton tooltip="Add data" icon={<IconDatabasePlus />} />}
    >
      <DatabaseForm form={form} handleSubmit={handleSubmit} />
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
