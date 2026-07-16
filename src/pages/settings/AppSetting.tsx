import { getTauriVersion, getVersion } from '@tauri-apps/api/app';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import * as dialog from '@tauri-apps/plugin-dialog';
import { relaunch } from '@tauri-apps/plugin-process';
import * as shell from '@tauri-apps/plugin-shell';
import { Update } from '@tauri-apps/plugin-updater';
import { atom, useAtom } from 'jotai';
import { SettingsIcon } from 'lucide-react';
import { nanoid } from 'nanoid';
import { PropsWithChildren, useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';

import { checkAppUpdate, checkSqlfmt, type SqlfmtCheckResult } from '@/api';
import { Dialog } from '@/components/custom/Dialog';
import {
  FontFamilyCombobox,
  useSystemFontFamilies,
} from '@/components/custom/FontFamilyCombobox';
import { SidebarNav } from '@/components/custom/siderbar-nav';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox';
import { DialogClose, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import {
  CsvParam,
  HolywellOptions,
  SettingState,
  SqlFormatterOptions,
  SqlfmtOptions,
  defaultHolywellOptions,
  defaultSettings,
  defaultSqlFormatterOptions,
  defaultSqlfmtOptions,
  editorThemes,
  resolveHolywellOptions,
  resolveSqlFormatterOptions,
  resolveSqlfmtOptions,
  settingAtom,
  sqlCaseOptions,
  sqlFormatterEngines,
  sqlIndentStyleOptions,
  sqlLogicalNewlineOptions,
  sqlfmtDialectOptions,
  updaterSources,
  useSettingStore,
} from '@/stores/setting';
import { isEmpty } from 'radash';

const items = [
  {
    key: 'profile',
    title: 'Appearance',
  },
  {
    key: 'sql-format',
    title: 'SQL Formatting',
  },
  {
    key: 'csv',
    title: 'Import/Export',
  },
  {
    key: 'update',
    title: 'Software Update',
  },
];

export const navKeyAtom = atom('profile');

export const Display = ({ hidden, children }: PropsWithChildren<{ hidden: boolean }>) => (
  <div className={hidden ? 'flex flex-col h-full' : 'hidden'}>{children}</div>
);

export default function AppSettingDialog() {
  const [navKey, setNavKey] = useAtom(navKeyAtom);
  return (
    <Dialog
      title="Setting"
      className="min-w-[800px] min-h-[600px] max-h-[calc(100dvh-2rem)]"
      trigger={
        <Button variant="ghost" size="icon" className="size-8 rounded-lg">
          <SettingsIcon className="size-4" />
        </Button>
      }
    >
      <div className="flex min-h-0 flex-col space-y-8 overflow-y-auto overflow-x-hidden pb-1 lg:flex-row lg:space-x-12 lg:space-y-0">
        <SidebarNav items={items} activeKey={navKey} setKey={setNavKey} />

        <div className="flex-1 lg:max-w-2xl h-full">
          <Display hidden={navKey == 'profile'}>
            <Profile />
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
  const [settings, setSettings] = useAtom(settingAtom);
  const { fonts: systemFonts } = useSystemFontFamilies();
  const form = useForm({
    defaultValues: {
      ...defaultSettings,
      ...settings,
    },
  });

  const onSubmit = (data: SettingState) => {
    setSettings((s) => ({
      ...s,
      main_font_family: data.main_font_family,
      table_font_family: data.table_font_family,
      editor_theme: data.editor_theme,
      precision: data.precision,
    }));
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="h-full flex flex-col">
        <div className="flex-1 space-y-4">
          <FormField
            control={form.control}
            name="main_font_family"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Main Font Family</FormLabel>
                <FontFamilyCombobox
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  placeholder="Search system fonts"
                  fonts={systemFonts}
                />
                <FormDescription>
                  Search and select an installed system font.
                </FormDescription>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="table_font_family"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Table Font Family</FormLabel>
                <FontFamilyCombobox
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  placeholder="Search system fonts"
                  fonts={systemFonts}
                />
                <FormDescription>
                  Used by the data table canvas renderer.
                </FormDescription>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="editor_theme.light"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Editor Light Theme</FormLabel>

                <Combobox
                  value={lightItems.find((i) => i.value === field.value) ?? null}
                  onValueChange={(v) => field.onChange(v?.value ?? '')}
                  items={lightItems}
                  itemToStringValue={(item) => item?.label}
                >
                  <FormControl>
                    <ComboboxInput placeholder="Select editor theme" />
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
                <FormLabel>Editor Dark Theme</FormLabel>
                <Combobox
                  value={darkItems.find((i) => i.value === field.value) ?? null}
                  onValueChange={(v) => field.onChange(v?.value ?? '')}
                  items={darkItems}
                  itemToStringValue={(item) => item?.label}
                >
                  <FormControl>
                    <ComboboxInput placeholder="Select editor theme" />
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
                  Reference:{' '}
                  <a href="https://textmate-grammars-themes.netlify.app/" target="_blank">
                    Shiki TextMate Grammar & Theme Playground
                  </a>
                  .
                </FormDescription>
              </FormItem>
            )}
          />
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
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="secondary">Cancel</Button>}></DialogClose>
          <Button type="submit">Update</Button>
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
  const [settings, setSettings] = useAtom(settingAtom);
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

  useEffect(() => {
    if (formatterEngine !== 'shandy-sqlfmt') {
      setSqlfmtStatus(null);
      return;
    }
    void runSqlfmtCheck(form.getValues('sqlfmt_options.path'));
    // Only auto-check when the engine is selected; path edits use Check / Browse.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formatterEngine]);

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
      <form onSubmit={form.handleSubmit(onSubmit)} className="h-full flex flex-col">
        <div className="flex-1 space-y-4">
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
                  <FormLabel>SQL Formatter Engine</FormLabel>
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
                      <ComboboxInput placeholder="Select SQL formatter" />
                    </FormControl>
                    <ComboboxContent>
                      <ComboboxList>
                        {sqlFormatterEngines.map((item) => (
                          <ComboboxItem key={item.id} value={item}>
                            <div className="flex flex-col">
                              <span>{item.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {item.description}
                              </span>
                            </div>
                          </ComboboxItem>
                        ))}
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                  <FormDescription>
                    Used by Format Document / Format Selection in the SQL editor.
                  </FormDescription>
                </FormItem>
              );
            }}
          />

          {formatterEngine === 'sql-formatter' ? (
            <div className="space-y-4 rounded-md border p-3">
              <div>
                <Label className="text-sm font-medium">sql-formatter options</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Dialect still follows the active connection. Defaults match previous behavior.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="sql_formatter_options.tabWidth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tab width</FormLabel>
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
                      <FormLabel>Expression width</FormLabel>
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
                      <FormLabel>Lines between queries</FormLabel>
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
                      <FormLabel>Indent style</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={(v) =>
                          field.onChange(v ?? defaultSqlFormatterOptions.indentStyle)
                        }
                        items={sqlIndentStyleOptions}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectGroup>
                            {sqlIndentStyleOptions.map((item) => (
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
                      <FormLabel>Keyword case</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={(v) =>
                          field.onChange(v ?? defaultSqlFormatterOptions.keywordCase)
                        }
                        items={sqlCaseOptions}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectGroup>
                            {sqlCaseOptions.map((item) => (
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
                      <FormLabel>Identifier case</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={(v) =>
                          field.onChange(
                            v ?? defaultSqlFormatterOptions.identifierCase,
                          )
                        }
                        items={sqlCaseOptions}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectGroup>
                            {sqlCaseOptions.map((item) => (
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
                      <FormLabel>Function case</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={(v) =>
                          field.onChange(v ?? defaultSqlFormatterOptions.functionCase)
                        }
                        items={sqlCaseOptions}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectGroup>
                            {sqlCaseOptions.map((item) => (
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
                      <FormLabel>Data type case</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={(v) =>
                          field.onChange(v ?? defaultSqlFormatterOptions.dataTypeCase)
                        }
                        items={sqlCaseOptions}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectGroup>
                            {sqlCaseOptions.map((item) => (
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
                      <FormLabel>Logical operator newline</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={(v) =>
                          field.onChange(
                            v ?? defaultSqlFormatterOptions.logicalOperatorNewline,
                          )
                        }
                        items={sqlLogicalNewlineOptions}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectGroup>
                            {sqlLogicalNewlineOptions.map((item) => (
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
                        <FormLabel>Use tabs</FormLabel>
                        <FormDescription>Indent with tabs instead of spaces</FormDescription>
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
                        <FormLabel>Dense operators</FormLabel>
                        <FormDescription>Pack operators without spaces</FormDescription>
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
                        <FormLabel>Newline before semicolon</FormLabel>
                        <FormDescription>Place `;` on its own line</FormDescription>
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
                <Label className="text-sm font-medium">holywell options</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  River-alignment style; dialect follows the active connection.
                </p>
              </div>
              <FormField
                control={form.control}
                name="holywell_options.maxLineLength"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max line length</FormLabel>
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
                      Preferred maximum output width in display columns.
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
                      <FormLabel>Recover on parse errors</FormLabel>
                      <FormDescription>
                        Keep unparseable statements as raw text instead of failing
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
                <Label className="text-sm font-medium">shandy-sqlfmt options</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Calls the external <code className="text-xs">sqlfmt</code> binary via Tauri.
                </p>
              </div>
              <FormField
                control={form.control}
                name="sqlfmt_options.path"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>sqlfmt Executable</FormLabel>
                    <FormControl>
                      <ButtonGroup>
                        <Input
                          placeholder="sqlfmt (from PATH) or absolute path"
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
                              await runSqlfmtCheck(file);
                            }
                          }}
                        >
                          Browse
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
                          {sqlfmtChecking ? <Spinner className="size-4" /> : 'Check'}
                        </Button>
                      </ButtonGroup>
                    </FormControl>
                    <FormDescription>
                      Install with{' '}
                      <code className="text-xs">uv tool install shandy-sqlfmt</code> or set the
                      full path to the <code className="text-xs">sqlfmt</code> binary.
                      {sqlfmtStatus ? (
                        <>
                          <br />
                          {sqlfmtStatus.available ? (
                            <span className="text-emerald-600 dark:text-emerald-400">
                              Available
                              {sqlfmtStatus.version ? `: ${sqlfmtStatus.version}` : ''}
                              {sqlfmtStatus.path ? ` (${sqlfmtStatus.path})` : ''}
                            </span>
                          ) : (
                            <span className="text-destructive">
                              Not available
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
                      <FormLabel>Line length</FormLabel>
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
                      <FormDescription>Passed as --line-length (default 88)</FormDescription>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="sqlfmt_options.dialect"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dialect</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={(v) =>
                          field.onChange(v ?? defaultSqlfmtOptions.dialect)
                        }
                        items={sqlfmtDialectOptions}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectGroup>
                            {sqlfmtDialectOptions.map((item) => (
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
                        Use ClickHouse to preserve identifier case sensitivity
                      </FormDescription>
                    </FormItem>
                  )}
                />
              </div>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="secondary">Cancel</Button>}></DialogClose>
          <Button type="submit">Update</Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

const UpdateForm = () => {
  const proxy = useSettingStore((state) => state.proxy);
  const updaterSource = useSettingStore(
    (state) => state.updater_source ?? defaultSettings.updater_source!,
  );

  const [settings, setSettings] = useAtom(settingAtom);
  const form = useForm({
    defaultValues: {
      ...settings,
      updater_source: settings.updater_source ?? defaultSettings.updater_source,
    },
  });

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
  const [size, setSize] = useState<number | null>();

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
        toast.success("It's the latest version");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Update check failed: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdater = async () => {
    setLoading(true);
    await update?.downloadAndInstall((e) => {
      if (e.event == 'Started') {
        setSize(e.data.contentLength);
      } else if (e.event == 'Progress') {
        if (size) {
          e.data.chunkLength;
        }
      }
    });
    setLoading(false);
    await relaunch();
  };

  const debug = form.watch('debug');

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className=" h-full flex flex-col">
          <div className="flex-1 space-y-4">
            <Item variant="outline" className="shadow-sm">
              <ItemContent>
                <FormLabel>Current version: {version}</FormLabel>
                {/* <FormDescription>Tauri: {tauriVersion}</FormDescription> */}
                {update?.version && (
                  <FormDescription>Discover new version: {update?.version}</FormDescription>
                )}
              </ItemContent>
              <ItemActions>
                {update?.version ? (
                  <Button
                    disabled={loading}
                    onClick={async (e) => {
                      e.preventDefault();
                      await handleUpdater();
                    }}
                  >
                    {loading ? <Spinner /> : null}
                    Click to update
                  </Button>
                ) : (
                  <Button
                    disabled={loading}
                    onClick={async (e) => {
                      e.preventDefault();
                      await handleCheck();
                    }}
                  >
                    {loading ? <Spinner /> : null}
                    Check for updates
                  </Button>
                )}
              </ItemActions>
            </Item>
            <FormField
              control={form.control}
              name="updater_source"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Update source</FormLabel>
                  <Select
                    value={field.value ?? 'official'}
                    onValueChange={(v) => field.onChange(v ?? 'official')}
                    items={updaterSources.map((s) => ({
                      label: s.name,
                      value: s.id,
                    }))}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectGroup>
                        {updaterSources.map((item) => (
                          <SelectItem
                            key={item.id}
                            value={item.id}
                            label={item.name}
                          >
                            <div className="flex flex-col items-start">
                              <span>{item.name}</span>
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
                    Official uses GitHub Releases. China Mirror goes through gh-proxy.com for
                    better connectivity in mainland China.
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
                        <ItemTitle>Automatic updates</ItemTitle>
                        <ItemDescription>
                          Turn this off to prevent the app from checking for updates.
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
                  <FormLabel>Proxy</FormLabel>
                  <FormDescription>use a proxy server for updater</FormDescription>
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
                  <FormLabel>Debug</FormLabel>
                  <FormDescription>Open developer debugging page</FormDescription>
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
                      Open
                    </Button>
                  </div>
                </FormItem>
              )}
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="secondary">Cancel</Button>}></DialogClose>
            <Button type="submit">Update</Button>
          </DialogFooter>
        </form>
      </Form>
    </>
  );
};

const CSVForm = () => {
  // https://duckdb.org/docs/stable/data/csv/overview#parameters
  // https://duckdb.org/docs/stable/sql/statements/copy#csv-options
  const [settings, setSettings] = useAtom(settingAtom);
  const form = useForm({
    defaultValues: settings.csv,
  });

  const onSubmit = (data: CsvParam) => {
    setSettings((s) => ({ ...s, csv: data }));
  };

  return (
    <>
      <DialogDescription>
        Read csv file parameters, see:&nbsp;
        <a
          className="prose prose-a:text-link text-link border-b-[1px] cursor-pointer"
          onClick={() => shell.open('https://duckdb.org/docs/data/csv/overview.html#parameters')}
        >
          csv parameters
        </a>
      </DialogDescription>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full">
          <div className="flex-1 space-y-4">
            <FormField
              control={form.control}
              name="delim"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Delim</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormDescription>
                    Specifies the string that separates columns within each row (line) of the file.
                  </FormDescription>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="quote"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quote</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormDescription>
                    Specifies the quoting string to be used when a data value is quoted.
                  </FormDescription>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="escape"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Escape</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormDescription>
                    Specifies the string that should appear before a data character sequence that
                    matches the quote value.
                  </FormDescription>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="new_line"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New line</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormDescription>
                    Set the new line character(s) in the file. Options are '\r','\n', or '\r\n'.
                  </FormDescription>
                </FormItem>
              )}
            />
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="secondary">Cancel</Button>}></DialogClose>
            <Button className="mx-0" type="submit">
              Update
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </>
  );
};
