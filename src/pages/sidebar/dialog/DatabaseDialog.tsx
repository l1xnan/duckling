import { Trans, useLingui } from '@lingui/react/macro';
import { IconDatabasePlus } from '@tabler/icons-react';
import * as dialog from '@tauri-apps/plugin-dialog';
import { useEffect, useMemo, useState } from 'react';
import { useForm, UseFormReturn } from 'react-hook-form';

import { listSshConfigHosts, SshConfigHost, testConnection } from '@/api';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DialectConfig, DialectType, useDBListStore } from '@/stores/dbList';
import { TreeNode } from '@/types';
import { nanoid } from 'nanoid';
import { toast } from 'sonner';

/** Form values: dialect config + optional connection display name. */
export type ConnectionFormValues = DialectConfig & {
  displayName?: string;
};

/** Derive a default connection name from the current form / config fields. */
export function defaultConnectionName(
  values: Partial<ConnectionFormValues> | DialectConfig | undefined,
): string {
  if (!values) {
    return 'connection';
  }
  const path =
    'path' in values && typeof values.path === 'string' ? values.path : undefined;
  if (path) {
    const base =
      path.replaceAll('\\', '/').split('/').filter(Boolean).at(-1) ?? path;
    return base || path;
  }
  const uri =
    'uri' in values && typeof values.uri === 'string' ? values.uri : undefined;
  if (uri) {
    return uri;
  }
  const host =
    'host' in values && typeof values.host === 'string' ? values.host : undefined;
  const port =
    'port' in values && typeof values.port === 'string' ? values.port : undefined;
  const database =
    'database' in values && typeof values.database === 'string'
      ? values.database
      : undefined;
  if (host) {
    const hostPort = port ? `${host}:${port}` : host;
    return database ? `${hostPort}/${database}` : hostPort;
  }
  return typeof values.dialect === 'string' ? values.dialect : 'connection';
}

export function resolveConnectionDisplayName(
  values: ConnectionFormValues,
): string {
  const custom = values.displayName?.trim();
  if (custom) {
    return custom;
  }
  return defaultConnectionName(values);
}

export function toDialectConfig(values: ConnectionFormValues): DialectConfig {
  const { displayName: _name, ...configFields } = values;
  return configFields as DialectConfig;
}

export async function runConnectionTest(
  values: ConnectionFormValues,
  options?: { connectionId?: string },
): Promise<void> {
  await testConnection(toDialectConfig(values), options);
}

type DatabaseFormProps = {
  form: UseFormReturn<ConnectionFormValues>;
  handleSubmit: (values: ConnectionFormValues) => Promise<void>;
  isNew?: boolean;
};

export function DatabaseForm({ form, handleSubmit, isNew = true }: DatabaseFormProps) {
  const { t } = useLingui();
  const watchDialect = form.watch('dialect');
  const watchSshEnabled = form.watch('ssh_tunnel.enabled');
  const watchedValues = form.watch();
  const [sshHosts, setSshHosts] = useState<SshConfigHost[]>([]);
  const supportsSsh = watchDialect === 'mysql' || watchDialect === 'postgres';
  const namePlaceholder = useMemo(
    () => defaultConnectionName(watchedValues),
    [watchedValues],
  );

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
    if (!supportsSsh || !watchSshEnabled) {
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
  }, [supportsSsh, watchSshEnabled]);

  const applySshConfigHost = (alias: string) => {
    const opts = { shouldDirty: true, shouldTouch: true, shouldValidate: false } as const;

    if (alias === '__custom__') {
      form.setValue('ssh_tunnel.config_host', '', opts);
      return;
    }

    const host = sshHosts.find((item) => item.alias === alias);
    if (!host) {
      return;
    }

    form.setValue('ssh_tunnel.config_host', alias, opts);
    form.setValue('ssh_tunnel.host', host.host, opts);
    form.setValue('ssh_tunnel.port', String(host.port || 22), opts);
    form.setValue('ssh_tunnel.username', host.username ?? '', opts);
    form.setValue('ssh_tunnel.private_key_path', host.identity_file ?? '', opts);
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="flex min-h-0 flex-1 flex-col"
      >
        <Tabs
          defaultValue="connection"
          className="flex w-full min-h-0 flex-1 flex-col gap-0"
        >
          <TabsList className="w-full shrink-0 justify-start">
            <TabsTrigger value="connection" className="flex-none px-3">
              <Trans>Connection</Trans>
            </TabsTrigger>
            {supportsSsh ? (
              <TabsTrigger value="ssh" className="flex-none px-3">
                <Trans>SSH Tunnel</Trans>
              </TabsTrigger>
            ) : null}
          </TabsList>

          <TabsContent
            value="connection"
            className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto"
          >
            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem className="flex items-center w-[62.5%]">
                  <FormLabel className="w-1/5 mr-2 mt-2">
                    <Trans>Name</Trans>
                  </FormLabel>
                  <FormControl className="w-4/5">
                    <Input
                      {...field}
                      value={field.value ?? ''}
                      placeholder={namePlaceholder}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
                        form.setValue(
                          'disable_ssl',
                          form.getValues('disable_ssl') ?? true,
                        );
                      }
                      if (value !== 'mysql' && value !== 'postgres') {
                        form.setValue('ssh_tunnel', undefined, {
                          shouldDirty: false,
                        });
                      }
                    }}
                    disabled={!isNew}
                    value={field.value ?? null}
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
                          <SelectItem
                            key={item.value}
                            value={item.value}
                            label={item.label}
                          >
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            {watchDialect == 'clickhouse' ||
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
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
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
                      <FormLabel className="w-1/5 mr-2 mt-2">
                        <Trans>Path</Trans>
                      </FormLabel>
                      <FormControl className="w-4/5">
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
          </TabsContent>

          {supportsSsh ? (
            <TabsContent
              value="ssh"
              className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto"
            >
              <FormField
                control={form.control}
                name="ssh_tunnel.enabled"
                render={({ field }) => (
                  <FormItem className="flex items-center w-[62.5%]">
                    <FormLabel className="w-1/5 mr-2 mt-2">
                      <Trans>Enable SSH</Trans>
                    </FormLabel>
                    <FormControl>
                      <Switch
                        checked={!!field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {watchSshEnabled ? (
                <>
                  <FormField
                    control={form.control}
                    name="ssh_tunnel.config_host"
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
                              <SelectValue
                                placeholder={t`Select from ~/.ssh/config`}
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectGroup>
                              <SelectItem
                                value="__custom__"
                                label={t`Manual Input`}
                              >
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
                      name="ssh_tunnel.host"
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
                      name="ssh_tunnel.port"
                      render={({ field }) => (
                        <FormItem className="flex items-center w-[37.5%]">
                          <FormLabel className="ml-4">
                            <Trans>SSH Port</Trans>
                          </FormLabel>
                          <FormControl className="w-2/3">
                            <Input
                              placeholder="22"
                              {...field}
                              value={field.value ?? ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="ssh_tunnel.username"
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
                    name="ssh_tunnel.password"
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
                    name="ssh_tunnel.private_key_path"
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
                                  form.setValue(
                                    'ssh_tunnel.private_key_path',
                                    file,
                                    {
                                      shouldDirty: true,
                                      shouldTouch: true,
                                    },
                                  );
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
                    name="ssh_tunnel.passphrase"
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
            </TabsContent>
          ) : null}
        </Tabs>
      </form>
    </Form>
  );
}

export function DatabaseDialog() {
  const { t } = useLingui();
  const [open, setOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const form = useForm<ConnectionFormValues>({
    defaultValues: {
      disable_ssl: true,
      displayName: '',
      dialect: undefined,
    },
  });
  const appendDB = useDBListStore((state) => state.append);
  const updateDB = useDBListStore((state) => state.updateByConfig);

  async function handleSubmit(values: ConnectionFormValues) {
    const id = nanoid();
    const config = toDialectConfig(values);
    const displayName = resolveConnectionDisplayName(values);
    const initData = {
      id,
      dialect: config.dialect,
      config,
      displayName,
      data: { name: displayName, path: displayName } as TreeNode,
      loading: true,
    };
    // Await register so registry is ready before tree refresh.
    await appendDB(initData);
    setOpen(false);
    form.reset({ disable_ssl: true, displayName: '', dialect: undefined });
    await updateDB(id, config);
  }

  async function handleTest() {
    const values = form.getValues();
    if (!values.dialect) {
      toast.error(t`Select a dialect first`);
      return;
    }
    setTesting(true);
    try {
      await runConnectionTest(values);
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
