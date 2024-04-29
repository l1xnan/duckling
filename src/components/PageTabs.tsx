import Dialog from '@/components/custom/Dialog';

import ErrorBoundary from '@/components/ErrorBoundary';

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { ContextMenuItem } from '@/components/custom/context-menu';
import { Tooltip } from '@/components/custom/tooltip';
import { useDialog } from '@/components/custom/use-dialog';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { cn } from '@/lib/utils';
import { docsAtom, favoriteAtom } from '@/stores/app';
import {
  TabContextType,
  tabObjAtom,
  useTabsAtom,
  useTabsStore,
} from '@/stores/tabs';
import { DialogProps } from '@radix-ui/react-dialog';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { useAtom, useSetAtom } from 'jotai';
import { Code2Icon, SearchIcon, TableIcon, XIcon } from 'lucide-react';
import { shake } from 'radash';
import { PropsWithChildren, ReactNode } from 'react';
import { useForm } from 'react-hook-form';

export interface PageTabsProps {
  items: { tab: TabContextType; children: ReactNode }[];
  activeKey: string;
  fallback?: ReactNode;
  onRemove?: (key: string) => void;
  onChange: (key: string) => void;
  renderItem?: ({ tab }: { tab: TabContextType }) => JSX.Element;
}

export const tabTypeIcon = (type: string) =>
  type == 'search' ? SearchIcon : type == 'editor' ? Code2Icon : TableIcon;

export function TabItemContextMenu({
  tab,
  onRemove,
  onRemoveOther,
  children,
}: PropsWithChildren<{
  tab: TabContextType;
  onRemove: (key: string) => void;
  onRemoveOther: (key: string) => void;
}>) {
  const setFavorite = useSetAtom(favoriteAtom);
  const setDocs = useSetAtom(docsAtom);

  const { removeTab } = useTabsStore((state) => ({
    removeTab: state.remove,
  }));

  const handleDeleteTab = (tab: TabContextType) => {
    removeTab(tab.id, true);
    setDocs((prev) => shake(prev, (a) => a.id != tab.id));
  };
  const dialog = useDialog();

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger className="w-full">{children}</ContextMenuTrigger>
        <ContextMenuContent className="w-64">
          <ContextMenuItem
            onClick={async () => {
              onRemove(tab.id);
            }}
          >
            Close
          </ContextMenuItem>
          <ContextMenuItem
            onClick={async () => {
              onRemoveOther(tab.id);
            }}
          >
            Close Other
          </ContextMenuItem>

          <ContextMenuSeparator />

          <ContextMenuItem
            onClick={async () => {
              setFavorite((prev) => [...prev, tab]);
            }}
          >
            Favorite
          </ContextMenuItem>

          <ContextMenuSeparator />

          <ContextMenuItem
            onClick={async () => {
              await writeText(tab.displayName);
            }}
          >
            Copy
          </ContextMenuItem>
          {tab.type == 'editor' ? (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={dialog.trigger}>Rename</ContextMenuItem>
              <ContextMenuItem
                onClick={async () => {
                  handleDeleteTab(tab);
                }}
              >
                Delete
              </ContextMenuItem>
            </>
          ) : null}
        </ContextMenuContent>
      </ContextMenu>
      <RenameDialog {...dialog.props} id={tab.id} />
    </>
  );
}

export function PageTabs({
  items,
  activeKey,
  onChange,
  onRemove,
  renderItem,
}: PageTabsProps) {
  return (
    <Tabs
      className="w-full h-full flex flex-col justify-start items-start"
      value={activeKey}
      onValueChange={onChange}
    >
      <TabsList className="p-0 h-8 border-b-1 w-full justify-start">
        {items.map(({ tab }) => {
          return (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className={cn(
                'h-8 text-xs relative wm-200 pl-3 pr-1.5 rounded-none border-r',
                'group',
                'data-[state=active]:bg-muted',
                'data-[state=active]:text-foreground',
                'data-[state=active]:shadow-none',
                'data-[state=active]:rounded-none',
              )}
            >
              <div
                className={cn(
                  'h-[2px] w-full bg-[#1976d2] absolute bottom-0 left-0 invisible z-6',
                  'group-data-[state=active]:visible',
                )}
              />
              {renderItem ? (
                renderItem({ tab })
              ) : (
                <DefaultTab1 tab={tab} onRemove={onRemove} />
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>
      {items.map(({ tab, children }) => {
        return (
          <TabsContent
            key={tab.id}
            value={tab.id}
            forceMount
            hidden={tab.id != activeKey}
            className="h-full w-full mt-0 overflow-hidden"
          >
            <ErrorBoundary fallback={<p>Something went wrong</p>}>
              {children}
            </ErrorBoundary>
          </TabsContent>
        );
      })}
    </Tabs>
  );
}

export function DefaultTab({ tab, onRemove }) {
  const Comp = tabTypeIcon(tab.type);
  return (
    <div className="flex items-center justify-between">
      <Tooltip title={`${tab.type}: ${tab.displayName}`}>
        <>
          <Comp className="size-4 mr-1" />
          <div className="max-w-52 truncate">{tab.displayName}</div>
        </>
      </Tooltip>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'rounded-lg size-6 invisible',
          'group-hover:visible',
          'group-data-[state=active]:visible',
        )}
        onClick={(e) => {
          e.stopPropagation();
          onRemove?.(tab.id);
        }}
      >
        <XIcon className="size-4" />
      </Button>
    </div>
  );
}
export function DefaultTab1({ tab, onRemove }) {
  return (
    <>
      <span>{tab.displayName}</span>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'rounded-lg size-6 invisible',
          'group-hover:visible',
          'group-data-[state=active]:visible',
        )}
        onClick={(e) => {
          e.stopPropagation();
          onRemove?.(tab.id);
        }}
      >
        <XIcon className="size-4" />
      </Button>
    </>
  );
}

function RenameDialog({
  id,
  open,
  onOpenChange,
}: DialogProps & { id: string }) {
  if (!id) {
    return null;
  }
  const tabAtom = useTabsAtom(tabObjAtom, id);
  const [tab, setTab] = useAtom(tabAtom);

  const handleSubmit = ({ name }: { name: string }) => {
    setTab((prev) => ({ ...prev, displayName: name }));
    onOpenChange?.(false);
  };

  const form = useForm<{ name: string }>({
    defaultValues: { name: tab?.displayName },
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Rename">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
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
