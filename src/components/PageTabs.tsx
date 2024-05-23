import { ContextMenuItem } from '@/components/custom/context-menu';
import Dialog from '@/components/custom/Dialog';
import { Tooltip } from '@/components/custom/tooltip';
import { useDialog } from '@/components/custom/use-dialog';

import ErrorBoundary from '@/components/ErrorBoundary';

import { Button, ButtonProps } from '@/components/ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { DialogClose, DialogFooter } from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  Code2Icon,
  SearchIcon,
  TableIcon,
  XIcon,
} from 'lucide-react';
import { shake } from 'radash';
import {
  PropsWithChildren,
  ReactNode,
  useContext,
  useEffect,
  useRef,
} from 'react';
import { useForm } from 'react-hook-form';
import {
  ScrollMenu,
  VisibilityContext,
  type publicApiType,
} from 'react-horizontal-scrolling-menu';
import 'react-horizontal-scrolling-menu/dist/styles.css';

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
      <ContextMenu
        onOpenChange={(open) => {
          console.log(open);
        }}
      >
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

function usePrevious<T>(value: T) {
  const ref = useRef<T>();

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref.current;
}
type scrollVisibilityApiType = React.ContextType<typeof VisibilityContext>;

export function PageTabs({
  items,
  activeKey,
  onChange,
  onRemove,
  renderItem,
}: PageTabsProps) {
  // Add item and scroll to it
  const itemsPrev = usePrevious(items);
  const apiRef = useRef({} as scrollVisibilityApiType);
  useEffect(() => {
    const item = apiRef.current?.getItemById?.(activeKey);
    if (!item?.visible) {
      apiRef.current?.scrollToItem?.(
        apiRef.current?.getItemElementById(activeKey) as Element,
      );
    }
    if (items?.length > (itemsPrev?.length ?? 0)) {
    }
  }, [items, itemsPrev, activeKey]);

  const tabsList = items.map(({ tab }) => {
    const Comp = renderItem;
    return (
      <TabsTrigger
        id={tab.id}
        // @ts-ignore
        itemId={tab.id}
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
            'h-0.5 w-full bg-[#1976d2] absolute bottom-0 left-0 invisible z-6',
            'group-data-[state=active]:visible',
          )}
        />
        {Comp ? (
          <Comp tab={tab} />
        ) : (
          <DefaultTab1 tab={tab} onRemove={onRemove as (s: string) => void} />
        )}
      </TabsTrigger>
    );
  });
  return (
    <Tabs
      className="w-full h-full flex flex-col justify-start items-start"
      value={activeKey}
      onValueChange={onChange}
    >
      <ScrollArea className="w-full h-8 min-h-8 overflow-hidden">
        <ScrollBar orientation="horizontal" className="h-1.5" />
        <div className="w-full relative h-8 overflow-hidden">
          <TabsList className=" p-0 h-8 border-b-1 w-max flex flex-row justify-stretch">
            <ScrollMenu
              apiRef={apiRef}
              onWheel={onWheel}
              // LeftArrow={LeftArrow}
              // RightArrow={RightArrow}
            >
              {tabsList}
            </ScrollMenu>
          </TabsList>
        </div>
      </ScrollArea>
      {items.map(({ tab: { id }, children }) => {
        return (
          <TabsContent
            key={id}
            value={id}
            forceMount
            hidden={id != activeKey}
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

export interface TabItemProps {
  tab: TabContextType;
  onRemove: (id: string) => void;
}

export function DefaultTab({ tab, onRemove }: TabItemProps) {
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
        asChild
        variant="ghost"
        size="icon"
        className={cn(
          'rounded-lg size-4 invisible',
          'group-hover:visible',
          'group-data-[state=active]:visible',
          'hover:bg-selection',
        )}
        // https://github.com/radix-ui/primitives/issues/1807
        onPointerDown={(e) => {
          e.stopPropagation();
          onRemove?.(tab.id);
        }}
      >
        <XIcon className="size-4" />
      </Button>
    </div>
  );
}

export function DefaultTab1({ tab, onRemove }: TabItemProps) {
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
        onPointerDown={(e) => {
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

function onWheel(apiObj: publicApiType, ev: React.WheelEvent): void {
  // NOTE: no good standard way to distinguish touchpad scrolling gestures
  // but can assume that gesture will affect X axis, mouse scroll only Y axis
  // of if deltaY too small probably is it touchpad
  const isTouchpad = Math.abs(ev.deltaX) !== 0 || Math.abs(ev.deltaY) < 15;

  if (isTouchpad) {
    ev.stopPropagation();
    return;
  }

  if (ev.deltaY > 0) {
    apiObj.scrollNext();
  } else {
    apiObj.scrollPrev();
  }
}

export function LeftArrow() {
  const visibility = useContext<publicApiType>(VisibilityContext);
  const isFirstItemVisible = visibility.useIsVisible('last', true);

  // NOTE: Look here
  const onClick = () =>
    visibility.scrollToItem(visibility.getPrevElement(), 'smooth', 'start');

  return (
    <Arrow disabled={isFirstItemVisible} onClick={onClick} testId="left-arrow">
      <ChevronLeftIcon />
    </Arrow>
  );
}

export function RightArrow() {
  const visibility = useContext<publicApiType>(VisibilityContext);
  const isLastItemVisible = visibility.useIsVisible('first', false);

  // NOTE: Look here
  const onClick = () =>
    visibility.scrollToItem(visibility.getNextElement(), 'smooth', 'end');

  return (
    <Arrow disabled={isLastItemVisible} onClick={onClick} testId="right-arrow">
      <ChevronRightIcon />
    </Arrow>
  );
}

export function Arrow({
  children,
  disabled,
  onClick,
  className,
  testId,
}: {
  children: React.ReactNode;
  disabled: boolean;
  onClick: VoidFunction;
  className?: string;
  testId: string;
}) {
  return (
    <ArrowButton
      disabled={disabled}
      onClick={onClick}
      className={'arrow' + `-${className}`}
      data-testid={testId}
    >
      {children}
    </ArrowButton>
  );
}

const ArrowButton = (props: ButtonProps) => (
  <Button
    {...props}
    className={cn(
      'pointer flex w-6 flex-col justify-center select-none border-r-2 border',
      props.disabled ? 'opacity-0' : 'opacity-100',
    )}
  />
);
