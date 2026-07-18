import { Trans, useLingui } from '@lingui/react/macro';
import { IconDatabasePlus } from '@tabler/icons-react';
import * as dialog from '@tauri-apps/plugin-dialog';
import { useEffect, useMemo, useState } from 'react';
import { useForm, UseFormReturn } from 'react-hook-form';

import { listSshConfigHosts, SshConfigHost } from '@/api';
import { Dialog } from '@/components/custom/Dialog';
import { PasswordInput } from '@/components/custom/PasswordInput';
import { TooltipButton } from '@/components/custom/button';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
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
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { DialectConfig, DialectType, useDBListStore } from '@/stores/dbList';
import { TreeNode } from '@/types';
import { nanoid } from 'nanoid';

type DatabaseFormProps = {
  form: UseFormReturn<DialectConfig>;
  handleSubmit: (values: DialectConfig) => Promise<void>;
  isNew?: boolean;
};

export function DatabaseForm({ form, handleSubmit, isNew = true }: DatabaseFormProps) {
  const { t } = useLingui();
  const watchDialect = form.watch('dialect');
  const watchSshEnabled = form.watch('ssh_enabled');
  const [sshHosts, setSshHosts] = useState<SshConfigHost[]>([]);

  const dialectItems = useMemo(
    (): { label: string; value: DialectType }[] => [
      { label: 'DuckDB', value: 'duckdb' },
      { label: 'DuckDB(Quack)', value: 'quack' },
      { label: t`Data Folder`, value: 'folder' },
      { label: 'SQLite', value: 'sqlite' },
      { label: 'MySQL', value: 'mysql' },
      { label: 'Postgres', value: 'postgres' },
      { label: 'Clickhouse', value: 'clickhouse' },
    ],
    [t],
  );

  useEffect(() => {
    if (watchDialect === 'quack' && form.getValues('disable_ssl') === undefined) {
      form.setValue('disable_ssl', true);
    }
  }, [watchDialect, form]);

  useEffect(() => {
    if (
      (watchDialect !== 'mysql' && watchDialect !== 'postgres') ||
      !watchSshEnabled
    ) {
      return;
    }

    let cancelled = false;
    listSshConfigHosts()
      .then((hosts) => {
        if (!cancelled) {
          setSshHosts(hosts);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSshHosts([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [watchDialect, watchSshEnabled]);

  const applySshConfigHost = (alias: string) => {
    const opts = { shouldDirty: true, shouldTouch: true, shouldValidate: false } as const;

    if (alias === '__custom__') {
      form.setValue('ssh_config_host', '', opts);
      return;
    }

    const host = sshHosts.find((item) => item.alias === alias);
    if (!host) {
      return;
    }

    form.setValue('ssh_config_host', alias, opts);
    form.setValue('ssh_host', host.host, opts);
    form.setValue('ssh_port', String(host.port || 22), opts);
    form.setValue('ssh_username', host.username ?? '', opts);
    form.setValue('ssh_private_key_path', host.identity_file ?? '', opts);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col">
        <div className="flex-1 space-y-4">
          <FormField
            control={form.control}
            name="dialect"
            render={({ field }) => (
              <FormItem className="flex items-center w-[62.5%]">
                <FormLabel className="w-1/5 mr-2 mt-2">
                  <Trans>Dialect</Trans>
                </FormLabel>
                <Select
                  onValueChange={(value) => {
                    field.onChange(value);
                    if (value === 'quack') {
                      form.setValue('disable_ssl', form.getValues('disable_ssl') ?? true);
                    }
                  }}
                  defaultValue={field.value}
                  disabled={!isNew}
                  value={field.value}
                  items={dialectItems}
                >
                  <FormControl className="w-4/5">
                    <SelectTrigger>
                      <SelectValue placeholder={t`Select a dialect`} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectGroup>
                      {dialectItems.map((item) => (
                        <SelectItem key={item.value} value={item.value} label={item.label}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
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
                      <FormLabel className="w-1/5 mr-2 mt-2">
                        <Trans>Host</Trans>
                      </FormLabel>
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
                      <FormLabel className="ml-4">
                        <Trans>Port</Trans>
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
                    <FormLabel className="w-1/5 mr-2 mt-2">
                      <Trans>Database</Trans>
                    </FormLabel>
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
                    <FormLabel className="w-1/5 mr-2 mt-2">
                      <Trans>Username</Trans>
                    </FormLabel>
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
                    <FormLabel className="w-1/5 mr-2 mt-2">
                      <Trans>Password</Trans>
                    </FormLabel>
                    <FormControl className="w-4/5">
                      <PasswordInput
                        {...field}
                        value={field.value ?? ''}
                        placeholder={
                          isNew ? undefined : t`Leave empty to keep current`
                        }
                        autoComplete="off"
                        showToggleLabel={t`Show password`}
                        hideToggleLabel={t`Hide password`}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          ) : null}
          {watchDialect == 'mysql' || watchDialect == 'postgres' ? (
            <>
              <FormField
                control={form.control}
                name="ssh_enabled"
                render={({ field }) => (
                  <FormItem className="flex items-center w-[62.5%]">
                    <FormLabel className="w-1/5 mr-2 mt-2">
                      <Trans>SSH Tunnel</Trans>
                    </FormLabel>
                    <FormControl>
                      <Switch checked={!!field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {watchSshEnabled ? (
                <>
                  <FormField
                    control={form.control}
                    name="ssh_config_host"
                    render={({ field }) => (
                      <FormItem className="flex items-center w-[62.5%]">
                        <FormLabel className="w-1/5 mr-2 mt-2">
                          <Trans>SSH Config</Trans>
                        </FormLabel>
                        <Select
                          value={field.value || '__custom__'}
                          onValueChange={(value) => {
                            const alias =
                              typeof value === 'string'
                                ? value
                                : value != null &&
                                    typeof value === 'object' &&
                                    'value' in value
                                  ? String((value as { value: unknown }).value)
                                  : '';
                            if (!alias) {
                              return;
                            }
                            field.onChange(alias === '__custom__' ? '' : alias);
                            applySshConfigHost(alias);
                          }}
                          items={[
                            { label: t`Manual Input`, value: '__custom__' },
                            ...sshHosts.map((host) => ({
                              label: host.label,
                              value: host.alias,
                            })),
                          ]}
                        >
                          <FormControl className="w-4/5">
                            <SelectTrigger>
                              <SelectValue placeholder={t`Select from ~/.ssh/config`} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectGroup>
                              <SelectItem value="__custom__" label={t`Manual Input`}>
                                <Trans>Manual Input</Trans>
                              </SelectItem>
                              {sshHosts.map((host) => (
                                <SelectItem
                                  key={host.alias}
                                  value={host.alias}
                                  label={host.label}
                                >
                                  {host.label}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex">
                    <FormField
                      control={form.control}
                      name="ssh_host"
                      render={({ field }) => (
                        <FormItem className="flex items-center w-[62.5%]">
                          <FormLabel className="w-1/5 mr-2 mt-2">
                            <Trans>SSH Host</Trans>
                          </FormLabel>
                          <FormControl className="w-4/5">
                            <Input
                              placeholder="jump.example.com"
                              {...field}
                              value={field.value ?? ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="ssh_port"
                      render={({ field }) => (
                        <FormItem className="flex items-center w-[37.5%]">
                          <FormLabel className="ml-4">
                            <Trans>SSH Port</Trans>
                          </FormLabel>
                          <FormControl className="w-2/3">
                            <Input placeholder="22" {...field} value={field.value ?? ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="ssh_username"
                    render={({ field }) => (
                      <FormItem className="flex items-center w-[62.5%]">
                        <FormLabel className="w-1/5 mr-2 mt-2">
                          <Trans>SSH User</Trans>
                        </FormLabel>
                        <FormControl className="w-4/5">
                          <Input {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="ssh_password"
                    render={({ field }) => (
                      <FormItem className="flex items-center w-[62.5%]">
                        <FormLabel className="w-1/5 mr-2 mt-2">
                          <Trans>SSH Password</Trans>
                        </FormLabel>
                        <FormControl className="w-4/5">
                          <PasswordInput
                            {...field}
                            value={field.value ?? ''}
                            placeholder={
                              isNew ? undefined : t`Leave empty to keep current`
                            }
                            autoComplete="off"
                            showToggleLabel={t`Show password`}
                            hideToggleLabel={t`Hide password`}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="ssh_private_key_path"
                    render={({ field }) => (
                      <FormItem className="flex items-center w-[62.5%]">
                        <FormLabel className="w-1/5 mr-2 mt-2">
                          <Trans>Private Key</Trans>
                        </FormLabel>
                        <FormControl className="w-4/5">
                          <ButtonGroup>
                            <Input
                              placeholder="~/.ssh/id_rsa"
                              {...field}
                              value={field.value ?? ''}
                            />
                            <Button
                              aria-label={t`Select private key`}
                              variant="outline"
                              onClick={async (e) => {
                                e.preventDefault();
                                const file = await dialog.open({
                                  multiple: false,
                                  directory: false,
                                });
                                if (file) {
                                  form.setValue('ssh_private_key_path', file, {
                                    shouldDirty: true,
                                    shouldTouch: true,
                                  });
                                }
                              }}
                            >
                              <Trans>Select</Trans>
                            </Button>
                          </ButtonGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="ssh_passphrase"
                    render={({ field }) => (
                      <FormItem className="flex items-center w-[62.5%]">
                        <FormLabel className="w-1/5 mr-2 mt-2">
                          <Trans>Key Passphrase</Trans>
                        </FormLabel>
                        <FormControl className="w-4/5">
                          <PasswordInput
                            {...field}
                            value={field.value ?? ''}
                            placeholder={
                              isNew ? undefined : t`Leave empty to keep current`
                            }
                            autoComplete="off"
                            showToggleLabel={t`Show password`}
                            hideToggleLabel={t`Hide password`}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              ) : null}
            </>
          ) : null}
          {watchDialect == 'quack' ? (
            <>
              <FormField
                control={form.control}
                name="uri"
                render={({ field }) => (
                  <FormItem className="flex items-center w-[62.5%]">
                    <FormLabel className="w-1/5 mr-2 mt-2">URI</FormLabel>
                    <FormControl className="w-4/5">
                      <Input placeholder="quack:localhost:9494" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="token"
                render={({ field }) => (
                  <FormItem className="flex items-center w-[62.5%]">
                    <FormLabel className="w-1/5 mr-2 mt-2">
                      <Trans>Token</Trans>
                    </FormLabel>
                    <FormControl className="w-4/5">
                      <PasswordInput
                        {...field}
                        value={field.value ?? ''}
                        placeholder={
                          isNew ? undefined : t`Leave empty to keep current`
                        }
                        autoComplete="off"
                        showToggleLabel={t`Show password`}
                        hideToggleLabel={t`Hide password`}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="disable_ssl"
                defaultValue={true}
                render={({ field }) => (
                  <FormItem className="flex items-center w-[62.5%]">
                    <FormLabel className="w-1/5 mr-2 mt-2">
                      <Trans>Disable SSL</Trans>
                    </FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          ) : null}
          {watchDialect == 'duckdb' || watchDialect == 'sqlite' || watchDialect == 'folder' ? (
            <>
              <FormField
                control={form.control}
                name="path"
                render={({ field }) => (
                  <FormItem className="flex items-center w-[62.5%]">
                    <FormLabel className="w-1/5 mr-2 mt-2">
                      <Trans>Path</Trans>
                    </FormLabel>
                    <FormControl className="w-4/5">
                      {/* <div className="flex w-full max-w-sm items-center gap-1"> */}
                      {/* </div> */}
                      <ButtonGroup>
                        <Input placeholder={t`Search...`} {...field} />
                        <Button
                          aria-label={t`Select`}
                          variant="outline"
                          onClick={async (e) => {
                            e.preventDefault();
                            const file = await dialog.open({
                              multiple: false,
                              directory: watchDialect == 'folder',
                            });
                            if (file) {
                              form.setValue('path', file);
                            }
                          }}
                        >
                          <Trans>Select</Trans>
                        </Button>
                      </ButtonGroup>
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
                    <FormLabel className="w-1/5 mr-2 mt-2">
                      <Trans>Work Path</Trans>
                    </FormLabel>
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
  const { t } = useLingui();
  const [open, setOpen] = useState(false);
  const form = useForm<DialectConfig>({
    defaultValues: {
      disable_ssl: true,
    },
  });
  const appendDB = useDBListStore((state) => state.append);
  const updateDB = useDBListStore((state) => state.updateByConfig);

  async function handleSubmit(values: DialectConfig) {
    const id = nanoid();
    const displayName =
      (values as { path?: string }).path ??
      (values as { host?: string }).host ??
      (values as { uri?: string }).uri ??
      values.dialect;
    const initData = {
      id,
      dialect: values.dialect,
      config: values,
      displayName,
      data: { name: displayName, path: displayName } as TreeNode,
      loading: true,
    };
    // Await register so registry is ready before tree refresh.
    await appendDB(initData);
    setOpen(false);
    form.reset({ disable_ssl: true } as DialectConfig);
    await updateDB(id, values);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title={<Trans>New Connection</Trans>}
      className="min-w-[800px] min-h-[500px]"
      trigger={<TooltipButton tooltip={t`Add data`} icon={<IconDatabasePlus />} />}
    >
      <DatabaseForm form={form} handleSubmit={handleSubmit} />
      <DialogFooter>
        <DialogClose render={<Button variant="secondary"><Trans>Cancel</Trans></Button>}></DialogClose>
        <Button type="submit" onClick={form.handleSubmit(handleSubmit)}>
          <Trans>Ok</Trans>
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
