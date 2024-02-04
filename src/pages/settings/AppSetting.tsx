import SettingsIcon from '@mui/icons-material/Settings';
import { DialogClose } from '@radix-ui/react-dialog';
import { ReloadIcon } from '@radix-ui/react-icons';
import { getTauriVersion, getVersion } from '@tauri-apps/api/app';
import { relaunch } from '@tauri-apps/plugin-process';
import { check } from '@tauri-apps/plugin-updater';
import * as React from 'react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { MuiIconButton } from '@/components/MuiIconButton';
import Dialog from '@/components/custom/Dialog';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Toaster } from '@/components/ui/sonner';
import { Switch } from '@/components/ui/switch';
import { SettingState, useSettingStore } from '@/stores/setting';

export default function AppSettingDialog() {
  const setStore = useSettingStore((state) => state.setStore);
  const precision = useSettingStore((state) => state.precision);
  const table_font_family = useSettingStore((state) => state.table_font_family);
  const auto_update = useSettingStore((state) => state.auto_update);
  const proxy = useSettingStore((state) => state.proxy);
  const form = useForm({
    defaultValues: {
      table_font_family,
      precision,
      auto_update,
      proxy,
    },
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [version, setVersion] = useState<string>();
  const [tauriVersion, seTtauriVersion] = useState<string>();
  const onSubmit = (data: SettingState) => {
    setStore(data);
    console.log('form:', data);
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
    <React.Fragment>
      <Toaster richColors position="top-center" />
      <Dialog
        title="Setting"
        trigger={
          <MuiIconButton>
            <SettingsIcon fontSize="inherit" />
          </MuiIconButton>
        }
      >
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
              name="auto_update"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>Automatic updates</FormLabel>
                    <FormDescription>
                      Turn this off to prevent the app from checking for
                      updates.
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
      </Dialog>
    </React.Fragment>
  );
}
