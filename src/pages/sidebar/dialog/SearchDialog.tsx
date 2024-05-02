import { atom } from 'jotai';
import { useForm } from 'react-hook-form';

import Dialog from '@/components/custom/Dialog';
import { SearchInput } from '@/components/custom/search';
import { Button } from '@/components/ui/button';
import { DialogClose, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem } from '@/components/ui/form';
import { SearchContextType, useTabsStore } from '@/stores/tabs';
import { NodeElementType } from '@/types';
import { DialogProps } from '@radix-ui/react-alert-dialog';
import { nanoid } from 'nanoid';

type SearchType = {
  open: boolean;
  item?: { displayName: string; tableId: string; dbId: string };
};

export const searchAtom = atom<SearchType>({
  open: false,
});

export function SearchDialog(props: DialogProps & { ctx: NodeElementType }) {
  const ctx = props.ctx;
  const updateTab = useTabsStore((state) => state.update);

  const handleSubmit = async ({ value }: { value: string }) => {
    console.log(value, ctx);

    const path = ctx?.path;
    if (path) {
      const item: SearchContextType = {
        id: nanoid(),
        dbId: ctx.dbId,
        path,
        value,
        displayName: ctx.path ?? '',
        type: 'search',
      };
      updateTab!(item);
    }
    props.onOpenChange?.(false);
  };

  const form = useForm<{ value: string }>({
    defaultValues: {},
  });

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={`Search: ${ctx?.path}`}
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
