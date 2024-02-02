import { useAtom, useAtomValue } from 'jotai';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { dbMapAtom, renameAtom, useDBListStore } from '@/stores/dbList';

// rename db
export default function RenameDialog() {
  const rename = useDBListStore((s) => s.rename);
  const dbMap = useAtomValue(dbMapAtom);

  const [context, setContext] = useAtom(renameAtom);
  const dbId = context?.dbId ?? '';
  const db = dbMap.get(dbId);

  const handClose = () => {
    setContext(null);
  };

  const handleSubmit = ({ name }: { name: string }) => {
    if (dbId && name) {
      rename(dbId, name);
    }
    handClose();
  };

  const form = useForm<{ name: string }>({
    defaultValues: { name: db?.displayName },
  });
  return (
    <Dialog open={context != null} onOpenChange={handClose}>
      <DialogContent
        className="min-w-[600px]"
        onInteractOutside={(e) => {
          e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Rename</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-8"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Working Directory</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
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
