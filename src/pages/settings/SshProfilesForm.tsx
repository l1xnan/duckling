import { Trans, useLingui } from '@lingui/react/macro';
import * as dialog from '@tauri-apps/plugin-dialog';
import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { listSshConfigHosts, type SshConfigHost } from '@/api';
import { PasswordInput } from '@/components/custom/PasswordInput';
import { Button } from '@/components/custom/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/custom/ui/form';
import { Input } from '@/components/custom/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/custom/ui/select';
import {
  getSshProfileSecrets,
  setSshProfileSecrets,
  useSshProfileStore,
  type SshProfile,
} from '@/stores/sshProfileList';

type ProfileFormValues = {
  displayName: string;
  host: string;
  port: string;
  username: string;
  private_key_path: string;
  config_host: string;
  host_key_policy: 'insecure' | 'accept_new' | 'strict';
  password: string;
  passphrase: string;
};

const emptyForm = (): ProfileFormValues => ({
  displayName: '',
  host: '',
  port: '22',
  username: '',
  private_key_path: '',
  config_host: '',
  host_key_policy: 'insecure',
  password: '',
  passphrase: '',
});

export function SshProfilesForm() {
  const { t } = useLingui();
  const profiles = useSshProfileStore((s) => s.profiles);
  const append = useSshProfileStore((s) => s.append);
  const update = useSshProfileStore((s) => s.update);
  const remove = useSshProfileStore((s) => s.remove);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [sshHosts, setSshHosts] = useState<SshConfigHost[]>([]);
  const form = useForm<ProfileFormValues>({ defaultValues: emptyForm() });

  useEffect(() => {
    let cancelled = false;
    listSshConfigHosts()
      .then((hosts) => {
        if (!cancelled) setSshHosts(hosts);
      })
      .catch(() => {
        if (!cancelled) setSshHosts([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const startCreate = () => {
    setEditingId(null);
    form.reset(emptyForm());
    setShowForm(true);
  };

  const startEdit = async (profile: SshProfile) => {
    setEditingId(profile.id);
    const secrets = await getSshProfileSecrets(profile.id);
    form.reset({
      displayName: profile.displayName,
      host: profile.host,
      port: profile.port ?? '22',
      username: profile.username,
      private_key_path: profile.private_key_path ?? '',
      config_host: profile.config_host ?? '',
      host_key_policy: profile.host_key_policy ?? 'insecure',
      password: secrets.ssh_password ?? '',
      passphrase: secrets.ssh_passphrase ?? '',
    });
    setShowForm(true);
  };

  const onSubmit = async (values: ProfileFormValues) => {
    if (!values.host.trim() || !values.username.trim()) {
      toast.error(t`SSH host and username are required`);
      return;
    }
    const base = {
      displayName: values.displayName.trim() || values.host.trim(),
      host: values.host.trim(),
      port: values.port.trim() || '22',
      username: values.username.trim(),
      private_key_path: values.private_key_path.trim() || undefined,
      config_host: values.config_host.trim() || undefined,
      host_key_policy: values.host_key_policy,
    };

    let id = editingId;
    if (id) {
      update(id, base);
    } else {
      id = append(base);
    }

    await setSshProfileSecrets(id, {
      ssh_password: values.password.trim() || undefined,
      ssh_passphrase: values.passphrase.trim() || undefined,
    });

    toast.success(editingId ? t`SSH profile updated` : t`SSH profile created`);
    setShowForm(false);
    setEditingId(null);
    form.reset(emptyForm());
  };

  const handleDelete = async (id: string) => {
    await remove(id);
    if (editingId === id) {
      setShowForm(false);
      setEditingId(null);
      form.reset(emptyForm());
    }
    toast.success(t`SSH profile deleted`);
  };

  const applySshConfigHost = (alias: string) => {
    const opts = { shouldDirty: true, shouldTouch: true } as const;
    if (alias === '__custom__') {
      form.setValue('config_host', '', opts);
      return;
    }
    const host = sshHosts.find((h) => h.alias === alias);
    if (!host) return;
    form.setValue('config_host', alias, opts);
    form.setValue('host', host.host, opts);
    form.setValue('port', String(host.port || 22), opts);
    form.setValue('username', host.username ?? '', opts);
    form.setValue('private_key_path', host.identity_file ?? '', opts);
    if (!form.getValues('displayName')) {
      form.setValue('displayName', host.label || alias, opts);
    }
  };

  return (
    <div className="flex min-h-0 h-full flex-col gap-4 overflow-hidden">
      <div className="flex shrink-0 items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">
            <Trans>SSH Tunnel Profiles</Trans>
          </h3>
          <p className="text-xs text-muted-foreground">
            <Trans>
              Save bastion hosts once, then reuse them when adding MySQL or
              Postgres connections.
            </Trans>
          </p>
        </div>
        <Button type="button" size="sm" onClick={startCreate}>
          <PlusIcon className="size-4" />
          <Trans>Add</Trans>
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {profiles.length === 0 && !showForm ? (
          <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            <Trans>No SSH profiles yet.</Trans>
          </div>
        ) : null}

        {profiles.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between rounded-md border px-3 py-2"
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{p.displayName}</div>
              <div className="truncate text-xs text-muted-foreground">
                {p.username}@{p.host}:{p.port || '22'}
              </div>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => void startEdit(p)}
              >
                <PencilIcon className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 text-destructive"
                onClick={() => void handleDelete(p.id)}
              >
                <Trash2Icon className="size-3.5" />
              </Button>
            </div>
          </div>
        ))}

        {showForm ? (
          <div className="rounded-md border p-3">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-3"
              >
                <FormField
                  control={form.control}
                  name="displayName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <Trans>Name</Trans>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t`e.g. Production bastion`}
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {sshHosts.length > 0 ? (
                  <FormField
                    control={form.control}
                    name="config_host"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          <Trans>From ~/.ssh/config</Trans>
                        </FormLabel>
                        <Select
                          value={field.value || '__custom__'}
                          onValueChange={(v) => {
                            const alias =
                              typeof v === 'string'
                                ? v
                                : v != null &&
                                    typeof v === 'object' &&
                                    'value' in v
                                  ? String((v as { value: unknown }).value)
                                  : '';
                            field.onChange(
                              alias === '__custom__' ? '' : alias,
                            );
                            applySshConfigHost(alias || '__custom__');
                          }}
                          items={[
                            { label: t`Manual Input`, value: '__custom__' },
                            ...sshHosts.map((h) => ({
                              label: h.label,
                              value: h.alias,
                            })),
                          ]}
                        >
                          <FormControl>
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
                              {sshHosts.map((h) => (
                                <SelectItem
                                  key={h.alias}
                                  value={h.alias}
                                  label={h.label}
                                >
                                  {h.label}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                ) : null}

                <div className="grid grid-cols-3 gap-2">
                  <FormField
                    control={form.control}
                    name="host"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>
                          <Trans>Host</Trans>
                        </FormLabel>
                        <FormControl>
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
                      <FormItem>
                        <FormLabel>
                          <Trans>Port</Trans>
                        </FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <Trans>Username</Trans>
                      </FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <Trans>Password</Trans>
                      </FormLabel>
                      <FormControl>
                        <PasswordInput
                          {...field}
                          value={field.value ?? ''}
                          placeholder={
                            editingId
                              ? t`Leave empty to keep current`
                              : undefined
                          }
                          autoComplete="off"
                          showToggleLabel={t`Show password`}
                          hideToggleLabel={t`Hide password`}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="private_key_path"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <Trans>Private Key</Trans>
                      </FormLabel>
                      <FormControl>
                        <ButtonGroup>
                          <Input
                            placeholder="~/.ssh/id_rsa"
                            {...field}
                            value={field.value ?? ''}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={async () => {
                              const file = await dialog.open({
                                multiple: false,
                                directory: false,
                              });
                              if (file) {
                                form.setValue(
                                  'private_key_path',
                                  String(file),
                                  {
                                    shouldDirty: true,
                                  },
                                );
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

                <FormField
                  control={form.control}
                  name="passphrase"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <Trans>Key Passphrase</Trans>
                      </FormLabel>
                      <FormControl>
                        <PasswordInput
                          {...field}
                          value={field.value ?? ''}
                          placeholder={
                            editingId
                              ? t`Leave empty to keep current`
                              : undefined
                          }
                          autoComplete="off"
                          showToggleLabel={t`Show password`}
                          hideToggleLabel={t`Hide password`}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="host_key_policy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <Trans>Host key</Trans>
                      </FormLabel>
                      <Select
                        value={field.value ?? 'insecure'}
                        onValueChange={(v) =>
                          field.onChange(
                            (typeof v === 'string' ? v : 'insecure') as
                              | 'insecure'
                              | 'accept_new'
                              | 'strict',
                          )
                        }
                        items={[
                          {
                            label: t`Trust all (insecure)`,
                            value: 'insecure',
                          },
                          {
                            label: t`Accept new keys`,
                            value: 'accept_new',
                          },
                          {
                            label: t`Strict (known_hosts)`,
                            value: 'strict',
                          },
                        ]}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem
                              value="insecure"
                              label={t`Trust all (insecure)`}
                            >
                              <Trans>Trust all (insecure)</Trans>
                            </SelectItem>
                            <SelectItem
                              value="accept_new"
                              label={t`Accept new keys`}
                            >
                              <Trans>Accept new keys</Trans>
                            </SelectItem>
                            <SelectItem
                              value="strict"
                              label={t`Strict (known_hosts)`}
                            >
                              <Trans>Strict (known_hosts)</Trans>
                            </SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowForm(false);
                      setEditingId(null);
                      form.reset(emptyForm());
                    }}
                  >
                    <Trans>Cancel</Trans>
                  </Button>
                  <Button type="submit">
                    {editingId ? (
                      <Trans>Save</Trans>
                    ) : (
                      <Trans>Create</Trans>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        ) : null}
      </div>
    </div>
  );
}
