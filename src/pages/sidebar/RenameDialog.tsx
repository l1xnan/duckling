import { useAtom } from 'jotai';
import { useForm } from 'react-hook-form';

import Dialog from '@/components/custom/Dialog';
import { Button } from '@/components/ui/button';
import { DialogClose, DialogFooter } from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { renameAtom, useDBListStore } from '@/stores/dbList';

// rename db
export default function RenameDialog() {
  const rename = useDBListStore((s) => s.rename);

  const [db, setContext] = useAtom(renameAtom);

  const handClose = () => {
    setContext(null);
  };

  const handleSubmit = ({ name }: { name: string }) => {
    rename(db!.id, name);
    handClose();
  };

  const form = useForm<{ name: string }>({
    defaultValues: { name: db?.displayName },
  });
  return (
    <Dialog open={db != null} onOpenChange={handClose} title="Rename">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
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
    </Dialog>
  );
}
