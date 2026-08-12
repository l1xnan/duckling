import { Trans, useLingui } from '@lingui/react/macro';
import { useForm } from 'react-hook-form';

import { FontFamilyCombobox } from '@/components/custom/FontFamilyCombobox';
import { Button } from '@/components/custom/ui/button';
import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/custom/ui/combobox';
import { DialogClose, DialogFooter } from '@/components/custom/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/custom/ui/form';
import { Input } from '@/components/custom/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  defaultSettings,
  editorThemes,
  setSettings,
  type SettingState,
  useSettingStore,
} from '@/stores/setting';

const darkItems = editorThemes
  .filter((t) => t.type == 'dark')
  .map((t) => ({ label: t.name, value: t.id }));

const lightItems = editorThemes
  .filter((t) => t.type == 'light')
  .map((t) => ({ label: t.name, value: t.id }));

type EditorSettings = Pick<
  SettingState,
  | 'code_font_family'
  | 'code_font_size'
  | 'code_editor_minimap'
  | 'default_statement_split'
  | 'editor_theme'
>;

export function EditorForm() {
  const { t } = useLingui();
  const settings = useSettingStore();
  const form = useForm<EditorSettings>({
    defaultValues: {
      code_font_family:
        settings.code_font_family ?? defaultSettings.code_font_family,
      code_font_size: settings.code_font_size ?? defaultSettings.code_font_size,
      code_editor_minimap:
        settings.code_editor_minimap ?? defaultSettings.code_editor_minimap,
      default_statement_split:
        settings.default_statement_split ?? defaultSettings.default_statement_split,
      editor_theme: settings.editor_theme ?? defaultSettings.editor_theme,
    },
  });

  const onSubmit = (data: EditorSettings) => {
    setSettings((s) => ({
      ...s,
      code_font_family: data.code_font_family,
      code_font_size: data.code_font_size,
      code_editor_minimap: data.code_editor_minimap ?? true,
      default_statement_split: data.default_statement_split ?? false,
      editor_theme: data.editor_theme,
    }));
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 h-full flex-col">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
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
            name="code_editor_minimap"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between gap-4 rounded-lg border p-3">
                <div className="space-y-0.5">
                  <FormLabel>
                    <Trans>Editor Minimap</Trans>
                  </FormLabel>
                  <FormDescription>
                    <Trans>
                      Show a minimap overview on the right side of the SQL editor.
                    </Trans>
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value ?? true}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="default_statement_split"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between gap-4 rounded-lg border p-3">
                <div className="space-y-0.5">
                  <FormLabel>
                    <Trans>Enable statement split by default</Trans>
                  </FormLabel>
                  <FormDescription>
                    <Trans>
                      When enabled, new SQL editor tabs run and highlight only the
                      statement at the cursor. You can still toggle this per tab from
                      the toolbar.
                    </Trans>
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={
                      field.value ?? defaultSettings.default_statement_split
                    }
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
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
