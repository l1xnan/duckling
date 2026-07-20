import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { getTauriVersion, getVersion } from '@tauri-apps/api/app';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import * as dialog from '@tauri-apps/plugin-dialog';
import { relaunch } from '@tauri-apps/plugin-process';
import * as shell from '@tauri-apps/plugin-shell';
import { Update } from '@tauri-apps/plugin-updater';
import { FolderOpenIcon, SettingsIcon } from 'lucide-react';
import { nanoid } from 'nanoid';
import { PropsWithChildren, useEffect, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';

import {
  checkAppUpdate,
  checkSqlfmt,
  openSettingsDir,
  type SqlfmtCheckResult,
} from '@/api';
import { Dialog } from '@/components/custom/Dialog';
import { FontFamilyCombobox } from '@/components/custom/FontFamilyCombobox';
import { SidebarNav } from '@/components/custom/siderbar-nav';
import { Button } from '@/components/custom/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/custom/ui/combobox';
import { DialogClose, DialogDescription, DialogFooter } from '@/components/custom/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/custom/ui/form';
import { Input } from '@/components/custom/ui/input';
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item';
import { Label } from '@/components/custom/ui/label';
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from '@/components/ui/progress';
import { HotkeysForm } from '@/pages/settings/HotkeysForm';
import { SshProfilesForm } from '@/pages/settings/SshProfilesForm';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/custom/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { setSessionIdleTtl } from '@/api';
import {
  CsvParam,
  HolywellOptions,
  LocalePreference,
  SettingState,
  SqlFormatterOptions,
  SqlfmtOptions,
  defaultHolywellOptions,
  defaultSettings,
  defaultSqlFormatterOptions,
  defaultSqlfmtOptions,
  editorThemes,
  resolveHolywellOptions,
  resolveSessionIdleTtlMinutes,
  resolveSqlFormatterOptions,
  resolveSqlfmtOptions,
  sessionIdleTtlMinutesToSecs,
  setSettings,
  sqlCaseOptions,
  sqlFormatterEngines,
  sqlIndentStyleOptions,
  sqlLogicalNewlineOptions,
  sqlfmtDialectOptions,
  updaterSources,
  useSettingStore,
} from '@/stores/setting';
import { isEmpty } from 'radash';

const NAV_ITEMS = [
  { key: 'profile', title: msg`Appearance` },
  { key: 'ssh', title: msg`SSH Profiles` },
  { key: 'hotkeys', title: msg`Keyboard shortcuts` },
  { key: 'sql-format', title: msg`SQL Formatting` },
  { key: 'csv', title: msg`Import/Export` },
  { key: 'update', title: msg`Software Update` },
] as const;

export const Display = ({ hidden, children }: PropsWithChildren<{ hidden: boolean }>) => (
  <div className={hidden ? 'flex min-h-0 h-full flex-col' : 'hidden'}>{children}</div>
);

export default function AppSettingDialog() {
  const { t } = useLingui();
  const [navKey, setNavKey] = useState('profile');
  const items = useMemo(
    () => NAV_ITEMS.map((item) => ({ key: item.key, title: t(item.title) })),
    [t],
  );

  return (
    <Dialog
      title={<Trans>Setting</Trans>}
      className="min-w-[800px] h-[min(600px,calc(100dvh-2rem))] max-h-[calc(100dvh-2rem)] overflow-hidden"
      trigger={
        <Button variant="ghost" size="icon" className="size-8 rounded-lg">
          <SettingsIcon className="size-4" />
        </Button>
      }
    >
      <div className="flex min-h-0 h-full flex-col gap-6 overflow-hidden lg:flex-row lg:gap-8">
        <SidebarNav items={items} activeKey={navKey} setKey={setNavKey} />

        <div className="min-h-0 flex-1 overflow-hidden lg:max-w-2xl">
          <Display hidden={navKey == 'profile'}>
            <Profile />
          </Display>
          <Display hidden={navKey == 'ssh'}>
            <SshProfilesForm />
          </Display>
          <Display hidden={navKey == 'hotkeys'}>
            <HotkeysForm />
          </Display>
          <Display hidden={navKey == 'sql-format'}>
            <SqlFormatForm />
          </Display>
          <Display hidden={navKey == 'csv'}>
            <CSVForm />
          </Display>
          <Display hidden={navKey == 'update'}>
            <UpdateForm />
          </Display>
        </div>
      </div>
    </Dialog>
  );
}

const darkItems = editorThemes
  .filter((t) => t.type == 'dark')
  .map((t) => ({ label: t.name, value: t.id }));

const lightItems = editorThemes
  .filter((t) => t.type == 'light')
  .map((t) => ({ label: t.name, value: t.id }));

function Profile() {
  const { t } = useLingui();
  const settings = useSettingStore();
  const form = useForm({
    defaultValues: {
      ...defaultSettings,
      ...settings,
    },
  });

  const localeOptions: { value: LocalePreference; label: string }[] = [
    { value: 'system', label: t`System` },
    { value: 'en', label: 'English' },
    { value: 'zh-CN', label: '简体中文' },
  ];

  const onSubmit = (data: SettingState) => {
    const session_idle_ttl_minutes = resolveSessionIdleTtlMinutes(
      data.session_idle_ttl_minutes,
    );
    setSettings((s) => ({
      ...s,
      locale: data.locale ?? 'system',
      main_font_family: data.main_font_family,
      table_font_family: data.table_font_family,
      table_font_size: data.table_font_size,
      code_font_family: data.code_font_family,
      code_font_size: data.code_font_size,
      editor_theme: data.editor_theme,
      precision: data.precision,
      session_idle_ttl_minutes,
    }));
    void setSessionIdleTtl(sessionIdleTtlMinutesToSecs(session_idle_ttl_minutes)).catch(
      (err) => console.warn('setSessionIdleTtl failed', err),
    );
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 h-full flex-col">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          <FormField
            control={form.control}
            name="locale"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Language</Trans>
                </FormLabel>
                <Select
                  value={field.value ?? 'system'}
                  onValueChange={(v) => field.onChange((v as LocalePreference) ?? 'system')}
                  items={localeOptions}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectGroup>
                      {localeOptions.map((item) => (
                        <SelectItem key={item.value} value={item.value} label={item.label}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FormDescription>
                  <Trans>
                    Follow the system language when available; otherwise fall back to English.
                  </Trans>
                </FormDescription>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="main_font_family"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Main Font Family</Trans>
                </FormLabel>
                <FontFamilyCombobox
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  placeholder={t`Search system fonts`}
                />
                <FormDescription>
                  <Trans>
                    Search installed fonts, or type any font name / CSS stack and choose Use.
                  </Trans>
                </FormDescription>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="table_font_family"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Table Font Family</Trans>
                </FormLabel>
                <FontFamilyCombobox
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  placeholder={t`Search system fonts`}
                />
                <FormDescription>
                  <Trans>
                    Used by the data table canvas renderer. Custom names are allowed.
                  </Trans>
                </FormDescription>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="table_font_size"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Table Font Size</Trans>
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={8}
                    max={32}
                    value={field.value ?? defaultSettings.table_font_size}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      field.onChange(
                        Number.isFinite(n)
                          ? Math.min(32, Math.max(8, n))
                          : defaultSettings.table_font_size,
                      );
                    }}
                  />
                </FormControl>
                <FormDescription>
                  <Trans>Font size in pixels for the data table (8–32).</Trans>
                </FormDescription>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="code_font_family"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Code Font Family</Trans>
                </FormLabel>
                <FontFamilyCombobox
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  placeholder={t`Search system fonts`}
                />
                <FormDescription>
                  <Trans>
                    Used by the Monaco SQL editor and other code viewers. Prefer monospace fonts.
                  </Trans>
                </FormDescription>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="code_font_size"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Code Font Size</Trans>
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={8}
                    max={32}
                    value={field.value ?? defaultSettings.code_font_size}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      field.onChange(
                        Number.isFinite(n)
                          ? Math.min(32, Math.max(8, n))
                          : defaultSettings.code_font_size,
                      );
                    }}
                  />
                </FormControl>
                <FormDescription>
                  <Trans>Font size in pixels for the Monaco editor (8–32).</Trans>
                </FormDescription>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="editor_theme.light"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Editor Light Theme</Trans>
                </FormLabel>

                <Combobox
                  value={lightItems.find((i) => i.value === field.value) ?? null}
                  onValueChange={(v) => field.onChange(v?.value ?? '')}
                  items={lightItems}
                  itemToStringValue={(item) => item?.label}
                >
                  <FormControl>
                    <ComboboxInput placeholder={t`Select editor theme`} />
                  </FormControl>
                  <ComboboxContent>
                    <ComboboxList>
                      {lightItems.map(({ label, value }) => (
                        <ComboboxItem key={value} value={{ label, value }}>
                          {label}
                        </ComboboxItem>
                      ))}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="editor_theme.dark"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Editor Dark Theme</Trans>
                </FormLabel>
                <Combobox
                  value={darkItems.find((i) => i.value === field.value) ?? null}
                  onValueChange={(v) => field.onChange(v?.value ?? '')}
                  items={darkItems}
                  itemToStringValue={(item) => item?.label}
                >
                  <FormControl>
                    <ComboboxInput placeholder={t`Select editor theme`} />
                  </FormControl>
                  <ComboboxContent>
                    <ComboboxList>
                      {darkItems.map(({ label, value }) => (
                        <ComboboxItem key={value} value={{ label, value }}>
                          {label}
                        </ComboboxItem>
                      ))}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
                <FormDescription>
                  <Trans>
                    Reference:{' '}
                    <a href="https://textmate-grammars-themes.netlify.app/" target="_blank">
                      Shiki TextMate Grammar & Theme Playground
                    </a>
                    .
                  </Trans>
                </FormDescription>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="precision"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Float precision</Trans>
                </FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="session_idle_ttl_minutes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Session idle timeout (minutes)</Trans>
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    max={24 * 60}
                    value={
                      field.value ?? defaultSettings.session_idle_ttl_minutes
                    }
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      field.onChange(
                        Number.isFinite(n)
                          ? resolveSessionIdleTtlMinutes(n)
                          : defaultSettings.session_idle_ttl_minutes,
                      );
                    }}
                  />
                </FormControl>
                <FormDescription>
                  <Trans>
                    Close idle database sessions (connection pools, SSH tunnels)
                    after this many minutes. Use 0 to keep sessions until the
                    app exits or the connection is removed.
                  </Trans>
                </FormDescription>
              </FormItem>
            )}
          />
          <Item variant="outline" className="shadow-sm">
            <ItemContent>
              <ItemTitle>
                <Trans>Settings folder</Trans>
              </ItemTitle>
              <ItemDescription>
                <Trans>
                  Open the local folder that stores app settings (settings.json).
                </Trans>
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <Button
                type="button"
                variant="secondary"
                onClick={async () => {
                  try {
                    await openSettingsDir();
                  } catch (error) {
                    const message =
                      error instanceof Error ? error.message : String(error);
                    toast.error(t`Failed to open settings folder: ${message}`);
                  }
                }}
              >
                <FolderOpenIcon className="size-4" />
                <Trans>Open folder</Trans>
              </Button>
            </ItemActions>
          </Item>
        </div>
        <DialogFooter className="shrink-0 border-t pt-4">
          <DialogClose
            render={
              <Button variant="secondary">
                <Trans>Cancel</Trans>
              </Button>
            }
          ></DialogClose>
          <Button type="submit">
            <Trans>Update</Trans>
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

type SqlFormatSettings = {
  sql_formatter_engine: NonNullable<SettingState['sql_formatter_engine']>;
  sql_formatter_options: SqlFormatterOptions;
  holywell_options: HolywellOptions;
  sqlfmt_options: SqlfmtOptions;
};

function numberFromInput(value: string, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function SqlFormatForm() {
  const { t } = useLingui();
  const settings = useSettingStore();
  const form = useForm<SqlFormatSettings>({
    defaultValues: {
      sql_formatter_engine:
        settings.sql_formatter_engine ?? defaultSettings.sql_formatter_engine!,
      sql_formatter_options: resolveSqlFormatterOptions(
        settings.sql_formatter_options,
      ),
      holywell_options: resolveHolywellOptions(settings.holywell_options),
      sqlfmt_options: resolveSqlfmtOptions(settings),
    },
  });

  const formatterEngine = useWatch({
    control: form.control,
    name: 'sql_formatter_engine',
  });

  const caseOptions = useMemo(
    () => sqlCaseOptions.map((item) => ({ value: item.value, label: t(item.label) })),
    [t],
  );
  const indentStyleOptions = useMemo(
    () =>
      sqlIndentStyleOptions.map((item) => ({
        value: item.value,
        label: t(item.label),
      })),
    [t],
  );
  const logicalNewlineOptions = useMemo(
    () =>
      sqlLogicalNewlineOptions.map((item) => ({
        value: item.value,
        label: t(item.label),
      })),
    [t],
  );
  const dialectOptions = useMemo(
    () =>
      sqlfmtDialectOptions.map((item) => ({
        value: item.value,
        label: t(item.label),
      })),
    [t],
  );

  const [sqlfmtStatus, setSqlfmtStatus] = useState<SqlfmtCheckResult | null>(null);
  const [sqlfmtChecking, setSqlfmtChecking] = useState(false);

  const runSqlfmtCheck = async (path?: string | null) => {
    setSqlfmtChecking(true);
    try {
      const result = await checkSqlfmt(path);
      setSqlfmtStatus(result);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const failed: SqlfmtCheckResult = {
        available: false,
        path: path?.trim() || 'sqlfmt',
        version: null,
        error: message,
      };
      setSqlfmtStatus(failed);
      return failed;
    } finally {
      setSqlfmtChecking(false);
    }
  };

  const onSubmit = (data: SqlFormatSettings) => {
    setSettings((s) => ({
      ...s,
      sql_formatter_engine: data.sql_formatter_engine,
      sql_formatter_options: data.sql_formatter_options,
      holywell_options: data.holywell_options,
      sqlfmt_options: data.sqlfmt_options,
      // Keep legacy key in sync for older readers / migration.
      sqlfmt_path: data.sqlfmt_options.path,
    }));
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 h-full flex-col">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          <FormField
            control={form.control}
            name="sql_formatter_engine"
            render={({ field }) => {
              const selected =
                sqlFormatterEngines.find((i) => i.id === field.value) ??
                sqlFormatterEngines[0] ??
                null;

              return (
                <FormItem>
                  <FormLabel>
                    <Trans>SQL Formatter Engine</Trans>
                  </FormLabel>
                  <Combobox
                    value={selected}
                    onValueChange={(v) =>
                      field.onChange(v?.id ?? 'sql-formatter')
                    }
                    items={sqlFormatterEngines}
                    itemToStringLabel={(item) => item.name}
                    isItemEqualToValue={(a, b) => a.id === b.id}
                  >
                    <FormControl>
                      <ComboboxInput placeholder={t`Select SQL formatter`} />
                    </FormControl>
                    <ComboboxContent>
                      <ComboboxList>
                        {sqlFormatterEngines.map((item) => (
                          <ComboboxItem key={item.id} value={item}>
                            <div className="flex flex-col">
                              <span>{item.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {t(item.description)}
                              </span>
                            </div>
                          </ComboboxItem>
                        ))}
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                  <FormDescription>
                    <Trans>
                      Used by Format Document / Format Selection in the SQL editor.
                    </Trans>
                  </FormDescription>
                </FormItem>
              );
            }}
          />

          {formatterEngine === 'sql-formatter' ? (
            <div className="space-y-4 rounded-md border p-3">
              <div>
                <Label className="text-sm font-medium">
                  <Trans>sql-formatter options</Trans>
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  <Trans>
                    Dialect still follows the active connection. Defaults match previous
                    behavior.
                  </Trans>
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="sql_formatter_options.tabWidth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <Trans>Tab width</Trans>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={16}
                          value={field.value}
                          onChange={(e) =>
                            field.onChange(
                              numberFromInput(
                                e.target.value,
                                defaultSqlFormatterOptions.tabWidth,
                              ),
                            )
                          }
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="sql_formatter_options.expressionWidth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <Trans>Expression width</Trans>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={10}
                          max={200}
                          value={field.value}
                          onChange={(e) =>
                            field.onChange(
                              numberFromInput(
                                e.target.value,
                                defaultSqlFormatterOptions.expressionWidth,
                              ),
                            )
                          }
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="sql_formatter_options.linesBetweenQueries"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <Trans>Lines between queries</Trans>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          max={10}
                          value={field.value}
                          onChange={(e) =>
                            field.onChange(
                              numberFromInput(
                                e.target.value,
                                defaultSqlFormatterOptions.linesBetweenQueries,
                              ),
                            )
                          }
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="sql_formatter_options.indentStyle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <Trans>Indent style</Trans>
                      </FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={(v) =>
                          field.onChange(v ?? defaultSqlFormatterOptions.indentStyle)
                        }
                        items={indentStyleOptions}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectGroup>
                            {indentStyleOptions.map((item) => (
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
                <FormField
                  control={form.control}
                  name="sql_formatter_options.keywordCase"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <Trans>Keyword case</Trans>
                      </FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={(v) =>
                          field.onChange(v ?? defaultSqlFormatterOptions.keywordCase)
                        }
                        items={caseOptions}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectGroup>
                            {caseOptions.map((item) => (
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
                <FormField
                  control={form.control}
                  name="sql_formatter_options.identifierCase"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <Trans>Identifier case</Trans>
                      </FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={(v) =>
                          field.onChange(
                            v ?? defaultSqlFormatterOptions.identifierCase,
                          )
                        }
                        items={caseOptions}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectGroup>
                            {caseOptions.map((item) => (
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
                <FormField
                  control={form.control}
                  name="sql_formatter_options.functionCase"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <Trans>Function case</Trans>
                      </FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={(v) =>
                          field.onChange(v ?? defaultSqlFormatterOptions.functionCase)
                        }
                        items={caseOptions}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectGroup>
                            {caseOptions.map((item) => (
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
                <FormField
                  control={form.control}
                  name="sql_formatter_options.dataTypeCase"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <Trans>Data type case</Trans>
                      </FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={(v) =>
                          field.onChange(v ?? defaultSqlFormatterOptions.dataTypeCase)
                        }
                        items={caseOptions}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectGroup>
                            {caseOptions.map((item) => (
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
                <FormField
                  control={form.control}
                  name="sql_formatter_options.logicalOperatorNewline"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <Trans>Logical operator newline</Trans>
                      </FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={(v) =>
                          field.onChange(
                            v ?? defaultSqlFormatterOptions.logicalOperatorNewline,
                          )
                        }
                        items={logicalNewlineOptions}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectGroup>
                            {logicalNewlineOptions.map((item) => (
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
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="sql_formatter_options.useTabs"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-md border px-3 py-2">
                      <div className="space-y-0.5">
                        <FormLabel>
                          <Trans>Use tabs</Trans>
                        </FormLabel>
                        <FormDescription>
                          <Trans>Indent with tabs instead of spaces</Trans>
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="sql_formatter_options.denseOperators"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-md border px-3 py-2">
                      <div className="space-y-0.5">
                        <FormLabel>
                          <Trans>Dense operators</Trans>
                        </FormLabel>
                        <FormDescription>
                          <Trans>Pack operators without spaces</Trans>
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="sql_formatter_options.newlineBeforeSemicolon"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-md border px-3 py-2 sm:col-span-2">
                      <div className="space-y-0.5">
                        <FormLabel>
                          <Trans>Newline before semicolon</Trans>
                        </FormLabel>
                        <FormDescription>
                          <Trans>Place `;` on its own line</Trans>
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>
          ) : null}

          {formatterEngine === 'holywell' ? (
            <div className="space-y-4 rounded-md border p-3">
              <div>
                <Label className="text-sm font-medium">
                  <Trans>holywell options</Trans>
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  <Trans>
                    River-alignment style; dialect follows the active connection.
                  </Trans>
                </p>
              </div>
              <FormField
                control={form.control}
                name="holywell_options.maxLineLength"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans>Max line length</Trans>
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={40}
                        max={200}
                        value={field.value}
                        onChange={(e) =>
                          field.onChange(
                            numberFromInput(
                              e.target.value,
                              defaultHolywellOptions.maxLineLength,
                            ),
                          )
                        }
                      />
                    </FormControl>
                    <FormDescription>
                      <Trans>Preferred maximum output width in display columns.</Trans>
                    </FormDescription>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="holywell_options.recover"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-md border px-3 py-2">
                    <div className="space-y-0.5">
                      <FormLabel>
                        <Trans>Recover on parse errors</Trans>
                      </FormLabel>
                      <FormDescription>
                        <Trans>
                          Keep unparseable statements as raw text instead of failing
                        </Trans>
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          ) : null}

          {formatterEngine === 'shandy-sqlfmt' ? (
            <div className="space-y-4 rounded-md border p-3">
              <div>
                <Label className="text-sm font-medium">
                  <Trans>shandy-sqlfmt options</Trans>
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  <Trans>
                    Calls the external <code className="text-xs">sqlfmt</code> binary via
                    Tauri.
                  </Trans>
                </p>
              </div>
              <FormField
                control={form.control}
                name="sqlfmt_options.path"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans>sqlfmt Executable</Trans>
                    </FormLabel>
                    <FormControl>
                      <ButtonGroup className="w-full">
                        <Input
                          className="flex-1"
                          placeholder={t`sqlfmt (from PATH) or absolute path`}
                          {...field}
                          value={field.value ?? ''}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={async (e) => {
                            e.preventDefault();
                            const file = await dialog.open({
                              multiple: false,
                              directory: false,
                            });
                            if (typeof file === 'string') {
                              field.onChange(file);
                              setSqlfmtStatus(null);
                            }
                          }}
                        >
                          <Trans>Browse</Trans>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={sqlfmtChecking}
                          onClick={async (e) => {
                            e.preventDefault();
                            await runSqlfmtCheck(field.value);
                          }}
                        >
                          {sqlfmtChecking ? <Spinner className="size-4" /> : <Trans>Check</Trans>}
                        </Button>
                      </ButtonGroup>
                    </FormControl>
                    <FormDescription>
                      <Trans>
                        Install with{' '}
                        <code className="text-xs">uv tool install shandy-sqlfmt</code> or
                        set the full path to the <code className="text-xs">sqlfmt</code>{' '}
                        binary.
                      </Trans>
                      {sqlfmtStatus ? (
                        <>
                          <br />
                          {sqlfmtStatus.available ? (
                            <span className="text-emerald-600 dark:text-emerald-400">
                              <Trans>Available</Trans>
                              {sqlfmtStatus.version ? `: ${sqlfmtStatus.version}` : ''}
                              {sqlfmtStatus.path ? ` (${sqlfmtStatus.path})` : ''}
                            </span>
                          ) : (
                            <span className="text-destructive">
                              <Trans>Not available</Trans>
                              {sqlfmtStatus.error ? `: ${sqlfmtStatus.error}` : ''}
                            </span>
                          )}
                        </>
                      ) : null}
                    </FormDescription>
                  </FormItem>
                )}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="sqlfmt_options.lineLength"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <Trans>Line length</Trans>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={40}
                          max={200}
                          value={field.value}
                          onChange={(e) =>
                            field.onChange(
                              numberFromInput(
                                e.target.value,
                                defaultSqlfmtOptions.lineLength,
                              ),
                            )
                          }
                        />
                      </FormControl>
                      <FormDescription>
                        <Trans>
                          Passed as <code className="text-xs">--line-length</code> (default
                          88)
                        </Trans>
                      </FormDescription>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="sqlfmt_options.dialect"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <Trans>Dialect</Trans>
                      </FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={(v) =>
                          field.onChange(v ?? defaultSqlfmtOptions.dialect)
                        }
                        items={dialectOptions}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectGroup>
                            {dialectOptions.map((item) => (
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
                      <FormDescription>
                        <Trans>
                          Use ClickHouse to preserve identifier case sensitivity
                        </Trans>
                      </FormDescription>
                    </FormItem>
                  )}
                />
              </div>
            </div>
          ) : null}
        </div>
        <DialogFooter className="shrink-0 border-t pt-4">
          <DialogClose
            render={
              <Button variant="secondary">
                <Trans>Cancel</Trans>
              </Button>
            }
          ></DialogClose>
          <Button type="submit">
            <Trans>Update</Trans>
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

const UpdateForm = () => {
  const { t } = useLingui();
  const proxy = useSettingStore((state) => state.proxy);
  const updaterSource = useSettingStore(
    (state) => state.updater_source ?? defaultSettings.updater_source!,
  );

  const settings = useSettingStore();
  const form = useForm({
    defaultValues: {
      ...settings,
      updater_source: settings.updater_source ?? defaultSettings.updater_source,
    },
  });

  const updaterSourceItems = useMemo(
    () =>
      updaterSources.map((s) => ({
        label: t(s.name),
        value: s.id,
        description: t(s.description),
      })),
    [t],
  );

  const [loading, setLoading] = useState<boolean>(false);
  const [version, setVersion] = useState<string>();
  const [_tauriVersion, setTauriVersion] = useState<string>();
  const onSubmit = (data: SettingState) => {
    setSettings((s) => ({
      ...s,
      auto_update: data.auto_update,
      proxy: data.proxy,
      debug: data.debug,
      updater_source: data.updater_source ?? 'official',
    }));
  };
  useEffect(() => {
    (async () => {
      setVersion(await getVersion());
      setTauriVersion(await getTauriVersion());
    })();
  });

  const [update, setUpdate] = useState<Update | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);

  const handleCheck = async () => {
    setLoading(true);
    try {
      const source =
        form.getValues('updater_source') ?? updaterSource ?? 'official';
      const next = await checkAppUpdate({
        source,
        proxy: form.getValues('proxy') ?? proxy,
      });
      console.log(next);
      setUpdate(next);
      if (next?.version != next?.currentVersion) {
        //
      } else {
        toast.success(t`It's the latest version`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(t`Update check failed: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdater = async () => {
    setLoading(true);
    setDownloadProgress(0);
    try {
      let downloaded = 0;
      let contentLength = 0;
      await update?.downloadAndInstall((e) => {
        switch (e.event) {
          case 'Started':
            contentLength = e.data.contentLength ?? 0;
            downloaded = 0;
            setDownloadProgress(0);
            break;
          case 'Progress':
            downloaded += e.data.chunkLength;
            if (contentLength > 0) {
              setDownloadProgress(
                Math.min(100, Math.round((downloaded / contentLength) * 100)),
              );
            }
            break;
          case 'Finished':
            setDownloadProgress(100);
            break;
        }
      });
      await relaunch();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(t`Update failed: ${message}`);
    } finally {
      setLoading(false);
      setDownloadProgress(null);
    }
  };

  const debug = form.watch('debug');

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 h-full flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            <Item variant="outline" className="shadow-sm">
              <ItemContent>
                <FormLabel>
                  <Trans>Current version: {version}</Trans>
                </FormLabel>
                {/* <FormDescription>Tauri: {tauriVersion}</FormDescription> */}
                {update?.version && (
                  <FormDescription>
                    <Trans>Discover new version: {update?.version}</Trans>
                  </FormDescription>
                )}
              </ItemContent>
              <ItemActions>
                {update?.version ? (
                  downloadProgress !== null ? (
                    <Progress value={downloadProgress} className="w-44">
                      <ProgressLabel>
                        <Trans>Downloading</Trans>
                      </ProgressLabel>
                      <ProgressValue />
                    </Progress>
                  ) : (
                    <Button
                      disabled={loading}
                      onClick={async (e) => {
                        e.preventDefault();
                        await handleUpdater();
                      }}
                    >
                      {loading ? <Spinner /> : null}
                      <Trans>Click to update</Trans>
                    </Button>
                  )
                ) : (
                  <Button
                    disabled={loading}
                    onClick={async (e) => {
                      e.preventDefault();
                      await handleCheck();
                    }}
                  >
                    {loading ? <Spinner /> : null}
                    <Trans>Check for updates</Trans>
                  </Button>
                )}
              </ItemActions>
            </Item>
            <FormField
              control={form.control}
              name="updater_source"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <Trans>Update source</Trans>
                  </FormLabel>
                  <Select
                    value={field.value ?? 'official'}
                    onValueChange={(v) => field.onChange(v ?? 'official')}
                    items={updaterSourceItems}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectGroup>
                        {updaterSourceItems.map((item) => (
                          <SelectItem
                            key={item.value}
                            value={item.value}
                            label={item.label}
                          >
                            <div className="flex flex-col items-start">
                              <span>{item.label}</span>
                              <span className="text-xs text-muted-foreground">
                                {item.description}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    <Trans>
                      Official uses GitHub Releases. China Mirror goes through gh-proxy.com
                      for better connectivity in mainland China.
                    </Trans>
                  </FormDescription>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="auto_update"
              render={({ field }) => (
                <FormItem>
                  <Item variant="outline" className="shadow-sm">
                    <ItemContent>
                      <div className="space-y-0.5">
                        <ItemTitle>
                          <Trans>Automatic updates</Trans>
                        </ItemTitle>
                        <ItemDescription>
                          <Trans>
                            Turn this off to prevent the app from checking for updates.
                          </Trans>
                        </ItemDescription>
                      </div>
                    </ItemContent>
                    <ItemActions>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </ItemActions>
                  </Item>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="proxy"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <Trans>Proxy</Trans>
                  </FormLabel>
                  <FormDescription>
                    <Trans>use a proxy server for updater</Trans>
                  </FormDescription>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="debug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <Trans>Debug</Trans>
                  </FormLabel>
                  <FormDescription>
                    <Trans>Open developer debugging page</Trans>
                  </FormDescription>
                  <div className="flex w-full items-center space-x-2">
                    <FormControl>
                      <Input placeholder="http://localhost:5173" {...field} />
                    </FormControl>
                    <Button
                      variant="secondary"
                      disabled={isEmpty(debug)}
                      onClick={async () => {
                        new WebviewWindow(`debug-${nanoid()}`, {
                          url: debug,
                          title: `Debug-${debug}`,
                        });
                      }}
                    >
                      <Trans>Open</Trans>
                    </Button>
                  </div>
                </FormItem>
              )}
            />
          </div>
          <DialogFooter className="shrink-0 border-t pt-4">
            <DialogClose
              render={
                <Button variant="secondary">
                  <Trans>Cancel</Trans>
                </Button>
              }
            ></DialogClose>
            <Button type="submit">
              <Trans>Update</Trans>
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </>
  );
};

const CSVForm = () => {
  // https://duckdb.org/docs/stable/data/csv/overview#parameters
  // https://duckdb.org/docs/stable/sql/statements/copy#csv-options
  const settings = useSettingStore();
  const form = useForm({
    defaultValues: settings.csv,
  });

  const onSubmit = (data: CsvParam) => {
    setSettings((s) => ({ ...s, csv: data }));
  };

  return (
    <div className="flex min-h-0 h-full flex-col">
      <DialogDescription className="shrink-0 pb-4">
        <Trans>
          Read csv file parameters, see:&nbsp;
          <a
            className="prose prose-a:text-link text-link border-b-[1px] cursor-pointer"
            onClick={() => shell.open('https://duckdb.org/docs/data/csv/overview.html#parameters')}
          >
            csv parameters
          </a>
        </Trans>
      </DialogDescription>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            <FormField
              control={form.control}
              name="delim"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <Trans>Delim</Trans>
                  </FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormDescription>
                    <Trans>
                      Specifies the string that separates columns within each row (line) of
                      the file.
                    </Trans>
                  </FormDescription>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="quote"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <Trans>Quote</Trans>
                  </FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormDescription>
                    <Trans>
                      Specifies the quoting string to be used when a data value is quoted.
                    </Trans>
                  </FormDescription>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="escape"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <Trans>Escape</Trans>
                  </FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormDescription>
                    <Trans>
                      Specifies the string that should appear before a data character
                      sequence that matches the quote value.
                    </Trans>
                  </FormDescription>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="new_line"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <Trans>New line</Trans>
                  </FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormDescription>
                    <Trans>
                      Set the new line character(s) in the file. Options are '\r','\n', or
                      '\r\n'.
                    </Trans>
                  </FormDescription>
                </FormItem>
              )}
            />
          </div>

          <DialogFooter className="shrink-0 border-t pt-4">
            <DialogClose
              render={
                <Button variant="secondary">
                  <Trans>Cancel</Trans>
                </Button>
              }
            ></DialogClose>
            <Button className="mx-0" type="submit">
              <Trans>Update</Trans>
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </div>
  );
};
