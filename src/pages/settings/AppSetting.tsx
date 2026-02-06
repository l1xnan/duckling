import { getTauriVersion, getVersion } from '@tauri-apps/api/app';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { relaunch } from '@tauri-apps/plugin-process';
import * as shell from '@tauri-apps/plugin-shell';
import { Update, check } from '@tauri-apps/plugin-updater';
import { atom, useAtom } from 'jotai';
import { SettingsIcon } from 'lucide-react';
import { nanoid } from 'nanoid';
import { PropsWithChildren, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Dialog } from '@/components/custom/Dialog';
import { SidebarNav } from '@/components/custom/siderbar-nav';
import { Button } from '@/components/ui/button';
import {
  DialogClose,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from '@/components/ui/item';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import {
  CsvParam,
  SettingState,
  editorThemes,
  settingAtom,
  useSettingStore,
} from '@/stores/setting';
import { isEmpty } from 'radash';

const items = [
  {
    key: 'profile',
    title: 'Appearance',
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

export const Display = ({
  hidden,
  children,
}: PropsWithChildren<{ hidden: boolean }>) => (
  <div className={hidden ? 'flex flex-col h-full' : 'hidden'}>{children}</div>
);

export default function AppSettingDialog() {
  const [navKey, setNavKey] = useAtom(navKeyAtom);
  return (
    <Dialog
      title="Setting"
      className="min-w-[800px] min-h-[600px]"
      trigger={
        <Button variant="ghost" size="icon" className="size-8 rounded-lg">
          <SettingsIcon className="size-4" />
        </Button>
      }
    >
      <div className="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
        <aside className="mr-4 lg:w-1/5">
          <SidebarNav items={items} activeKey={navKey} setKey={setNavKey} />
        </aside>
        <div className="flex-1 lg:max-w-2xl h-full">
          <Display hidden={navKey == 'profile'}>
            <Profile />
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

function Profile() {
  const [settings, setSettings] = useAtom(settingAtom);
  const form = useForm({
    defaultValues: settings,
  });

  const onSubmit = (data: SettingState) => {
    setSettings((s) => ({ ...s, ...data }));
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className=" h-full flex flex-col"
      >
        <div className="flex-1 space-y-4">
          <FormField
            control={form.control}
            name="main_font_family"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Main Font Family</FormLabel>
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

          <FormField
            control={form.control}
            name="editor_theme.light"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Editor Light Theme</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select editor theme" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {editorThemes
                      .filter((t) => t.type == 'light')
                      .map(({ name, id }) => (
                        <SelectItem key={id} value={id}>
                          {name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="editor_theme.dark"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Editor Dark Theme</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select editor theme" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {editorThemes
                      .filter((t) => t.type == 'dark')
                      .map(({ name, id }) => (
                        <SelectItem key={id} value={id}>
                          {name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  Reference:{' '}
                  <a
                    href="https://textmate-grammars-themes.netlify.app/"
                    target="_blank"
                  >
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
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <Button type="submit">Update</Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

const UpdateForm = () => {
  const proxy = useSettingStore((state) => state.proxy);

  const [settings, setSettings] = useAtom(settingAtom);
  const form = useForm({
    defaultValues: settings,
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [version, setVersion] = useState<string>();
  const [_tauriVersion, setTauriVersion] = useState<string>();
  const onSubmit = (data: SettingState) => {
    setSettings((s) => ({ ...s, ...data }));
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
    const update = await check({ proxy });
    console.log(update);
    setUpdate(update);
    if (update?.version != update?.currentVersion) {
      //
    } else {
      toast.success("It's the latest version");
    }
    setLoading(false);
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
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className=" h-full flex flex-col"
        >
          <div className="flex-1 space-y-4">
            <Item variant="outline" className="shadow-sm">
              <ItemContent>
                <FormLabel>Current version: {version}</FormLabel>
                {/* <FormDescription>Tauri: {tauriVersion}</FormDescription> */}
                {update?.version && (
                  <FormDescription>
                    Discover new version: {update?.version}
                  </FormDescription>
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
              name="auto_update"
              render={({ field }) => (
                <FormItem>
                  <Item variant="outline" className="shadow-sm">
                    <ItemContent>
                      <div className="space-y-0.5">
                        <ItemTitle>Automatic updates</ItemTitle>
                        <ItemDescription>
                          Turn this off to prevent the app from checking for
                          updates.
                        </ItemDescription>
                      </div>
                    </ItemContent>
                    <ItemActions>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
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
                  <FormDescription>
                    use a proxy server for updater
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
                  <FormLabel>Debug</FormLabel>
                  <FormDescription>
                    Open developer debugging page
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
                      Open
                    </Button>
                  </div>
                </FormItem>
              )}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button type="submit">Update</Button>
          </DialogFooter>
        </form>
      </Form>
    </>
  );
};

const CSVForm = () => {
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
          onClick={() =>
            shell.open(
              'https://duckdb.org/docs/data/csv/overview.html#parameters',
            )
          }
        >
          csv parameters
        </a>
      </DialogDescription>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col h-full"
        >
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
                    Specifies the string that separates columns within each row
                    (line) of the file.
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
                    Specifies the quoting string to be used when a data value is
                    quoted.
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
                    Specifies the string that should appear before a data
                    character sequence that matches the quote value.
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
                    Set the new line character(s) in the file. Options are
                    '\r','\n', or '\r\n'.
                  </FormDescription>
                </FormItem>
              )}
            />
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button className="mx-0" type="submit">
              Update
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </>
  );
};
