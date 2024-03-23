import { atom, useAtom } from 'jotai';
import { useForm } from 'react-hook-form';

import Dialog from '@/components/custom/Dialog';
import { SearchInput } from '@/components/custom/search.tsx';
import { Button } from '@/components/ui/button';
import { DialogClose, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem } from '@/components/ui/form';

type SearchType = {
  open: boolean;
  item?: { displayName: string; tableId: string };
};

export const searchAtom = atom<SearchType>({
  open: false,
});

export default function SearchDialog() {
  const [ctx, setCtx] = useAtom(searchAtom);

  const handClose = () => {
    setCtx({ open: false });
  };

  const handleSubmit = ({ value }: { value: string }) => {
    console.log(value, ctx);
    handClose();
  };

  const form = useForm<{ value: string }>({
    defaultValues: {},
  });

  return (
    <Dialog
      open={ctx.open}
      onOpenChange={handClose}
      title={`Search: ${ctx?.item?.tableId}`}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
          <FormField
            control={form.control}
            name="value"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <SearchInput {...field} className="h-9 border" />
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
