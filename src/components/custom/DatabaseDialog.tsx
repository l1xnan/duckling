import { IconDatabasePlus } from '@tabler/icons-react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';

import { MuiIconButton } from '../MuiIconButton';

export function DatabaseDialog() {
  const form = useForm();
  function onSubmit(values: unknown) {
    console.log(values);
  }
  return (
    <Dialog>
      <DialogTrigger asChild>
        <MuiIconButton>
          <IconDatabasePlus />
        </MuiIconButton>
      </DialogTrigger>
      <DialogContent
        className="min-w-[560px]"
        onInteractOutside={(e) => {
          e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>New Connection</DialogTitle>
          <DialogDescription>Clickhouse Connect Setting</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
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
                    <FormLabel className="w-1/3 mr-2 text-right mt-2">
                      Port
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
              name="host"
              render={({ field }) => (
                <FormItem className="flex items-center">
                  <FormLabel className="w-[12.5%] mr-2 mt-2">
                    Username
                  </FormLabel>
                  <FormControl className="w-[87.5%]">
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem className="flex items-center">
                  <FormLabel className="w-[12.5%] mr-2 mt-2">
                    Password
                  </FormLabel>
                  <FormControl className="w-[87.5%]">
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="secondary">Cancel</Button>
              </DialogClose>
              <Button type="submit">Ok</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
