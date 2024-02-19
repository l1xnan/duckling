import SettingsIcon from '@mui/icons-material/Settings';
import { DialogClose } from '@radix-ui/react-dialog';
import { ReloadIcon } from '@radix-ui/react-icons';
import { getTauriVersion, getVersion } from '@tauri-apps/api/app';
import { relaunch } from '@tauri-apps/plugin-process';
import * as shell from '@tauri-apps/plugin-shell';
import { check } from '@tauri-apps/plugin-updater';
import { atom, useAtom } from 'jotai';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { MuiIconButton } from '@/components/MuiIconButton';
import Dialog from '@/components/custom/Dialog';
import { SidebarNav } from '@/components/custom/siderbar-nav';
import { Button } from '@/components/ui/button';
import { DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  CsvParam,
  SettingState,
  settingAtom,
  useSettingStore,
} from '@/stores/setting';

const items = [
  {
    key: 'profile',
    title: 'Profile',
  },
  {
    key: 'csv',
    title: 'CSV',
  },
];

export const navKeyAtom = atom('profile');

export default function AppSettingDialog() {
  const [navKey, setNavkey] = useAtom(navKeyAtom);
  return (
    <Dialog
      title="Setting"
      trigger={
        <MuiIconButton>
          <SettingsIcon fontSize="inherit" />
        </MuiIconButton>
      }
    >
      <div className="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
        <aside className="-mx-4 lg:w-1/5">
          <SidebarNav items={items} activeKey={navKey} setKey={setNavkey} />
        </aside>
        <div className="flex-1 lg:max-w-2xl">
          <div className={navKey == 'profile' ? 'block' : 'hidden'}>
            <Profile />
          </div>
          <div className={navKey == 'csv' ? 'block' : 'hidden'}>
            <CSVForm />
          </div>
        </div>
      </div>
    </Dialog>
  );
}

function Profile() {
  const proxy = useSettingStore((state) => state.proxy);

  const [settings, setSettings] = useAtom(settingAtom);
  const form = useForm({
    defaultValues: settings,
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [version, setVersion] = useState<string>();
  const [tauriVersion, seTtauriVersion] = useState<string>();
  const onSubmit = (data: SettingState) => {
    setSettings(data);
  };
  useEffect(() => {
    (async () => {
      setVersion(await getVersion());
      seTtauriVersion(await getTauriVersion());
    })();
  });

  const handleUpdater = async () => {
    setLoading(true);
    const update = await check({ proxy });
    console.log(update);
    if (update?.version != update?.currentVersion) {
      toast('Discover new version', {
        action: {
          label: 'Update',
          onClick: async () => {
            await update?.downloadAndInstall();
            await relaunch();
          },
        },
      });
    } else {
      toast.success("It's the latest version");
    }
    setLoading(false);
  };
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
        <Separator className="my-4" />
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
          name="auto_update"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
              <div className="space-y-0.5">
                <FormLabel>Automatic updates</FormLabel>
                <FormDescription>
                  Turn this off to prevent the app from checking for updates.
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
        <div className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
          <div className="space-y-0.5">
            <FormLabel>Current version: {version}</FormLabel>
            <FormDescription>Tauri: {tauriVersion}</FormDescription>
          </div>
          <div>
            <Button
              disabled={loading}
              onClick={(e) => {
                e.preventDefault();
                handleUpdater();
              }}
            >
              {loading ? (
                <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Check for updates
            </Button>
          </div>
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
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
