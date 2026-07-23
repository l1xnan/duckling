import 'react-horizontal-scrolling-menu/dist/styles.css';

import { useDroppable } from '@dnd-kit/react';
import { useSortable } from '@dnd-kit/react/sortable';
import { Trans, useLingui } from '@lingui/react/macro';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { useSetAtom } from 'jotai';
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
  JSX,
  PropsWithChildren,
  ReactNode,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
} from 'react';
import { useForm } from 'react-hook-form';
import { ScrollMenu, VisibilityContext, type publicApiType } from 'react-horizontal-scrolling-menu';
import { useShallow } from 'zustand/shallow';

import { ContextMenuItem } from '@/components/custom/context-menu';
import { Dialog } from '@/components/custom/Dialog';
import { TitleTooltip } from '@/components/custom/tooltip';
import { useDialog } from '@/components/custom/use-dialog';
import ErrorBoundary from '@/components/ErrorBoundary';
import { Button } from '@/components/custom/ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/custom/ui/context-menu';
import { DialogFooter } from '@/components/custom/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/custom/ui/form';
import { Input } from '@/components/custom/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/custom/ui/tabs';
import { useTabDragSession } from '@/components/tabDragSession';
import { cn } from '@/lib/utils';
import { docsAtom, favoriteAtom } from '@/stores/app';
import { TabContextType, useTabsStore } from '@/stores/tabs';

export interface PageTabsProps {
  items: { tab: TabContextType; children: ReactNode }[];
  activeKey: string;
  /** When set, enables main-tab split/dnd for this pane. */
  paneId?: string;
  /** Whether this pane is the focused editor group (styles the active tab). */
  paneFocused?: boolean;
  fallback?: ReactNode;
  indicator?: 'top' | 'bottom';
  onRemove?: (key: string) => void;
  onChange: (key: string) => void;
  renderItem?: ({ tab }: { tab: TabContextType }) => JSX.Element;
}

function TabInsertLine({ side }: { side: 'before' | 'after' }) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute top-1 bottom-1 z-20 w-0.5 rounded-full bg-primary',
        side === 'before' ? 'left-0' : 'right-0',
      )}
    />
  );
}

export const TabTypeIcon = ({
  type,
  ...props
}: { type: string } & React.ComponentProps<typeof SearchIcon>) =>
  type == 'search' ? (
    <SearchIcon {...props} />
  ) : type == 'editor' ? (
    <Code2Icon {...props} />
  ) : (
    <TableIcon {...props} />
  );

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

  const { removeTab, split } = useTabsStore(
    useShallow((state) => ({
      removeTab: state.remove,
      split: state.split,
    })),
  );

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
            <Trans>Close</Trans>
          </ContextMenuItem>
          <ContextMenuItem
            onClick={async () => {
              onRemoveOther(tab.id);
            }}
          >
            <Trans>Close Other</Trans>
          </ContextMenuItem>

          <ContextMenuSeparator />

          <ContextMenuItem
            onClick={() => {
              split(tab.id, 'right');
            }}
          >
            <Trans>Split Right</Trans>
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => {
              split(tab.id, 'down');
            }}
          >
            <Trans>Split Down</Trans>
          </ContextMenuItem>

          <ContextMenuSeparator />

          <ContextMenuItem
            onClick={async () => {
              setFavorite((prev) => [...prev, tab]);
            }}
          >
            <Trans>Favorite</Trans>
          </ContextMenuItem>

          <ContextMenuSeparator />

          <ContextMenuItem
            onClick={async () => {
              await writeText(tab.displayName);
            }}
          >
            <Trans>Copy</Trans>
          </ContextMenuItem>
          {tab.type == 'editor' ? (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={dialog.trigger}>
                <Trans>Rename</Trans>
              </ContextMenuItem>
              <ContextMenuItem
                onClick={async () => {
                  handleDeleteTab(tab);
                }}
              >
                <Trans>Delete</Trans>
              </ContextMenuItem>
            </>
          ) : null}
        </ContextMenuContent>
      </ContextMenu>
      {tab.id ? <RenameDialog {...dialog.props} id={tab.id} /> : null}
    </>
  );
}

function usePrevious<T>(value: T) {
  const ref = useRef<T>(null);

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref?.current;
}

type ScrollVisibilityApiType = React.ContextType<typeof VisibilityContext>;

export function PageTabs({
  items,
  activeKey,
  paneId,
  paneFocused = true,
  indicator,
  onChange,
  onRemove,
  renderItem,
}: PageTabsProps) {
  const { draftOrders, indicator: dropIndicator, activeTabId } =
    useTabDragSession();

  // Header follows draft order while dragging; content mount order stays stable.
  const stripItems = useMemo(() => {
    if (!paneId || !draftOrders?.[paneId]) {
      return items;
    }
    const order = draftOrders[paneId];
    const byId = new Map(items.map((i) => [i.tab.id, i]));
    const ordered: typeof items = [];
    for (const id of order) {
      const item = byId.get(id);
      if (item) ordered.push(item);
    }
    for (const item of items) {
      if (!order.includes(item.tab.id)) ordered.push(item);
    }
    return ordered;
  }, [draftOrders, items, paneId]);

  const itemsPrev = usePrevious(stripItems);
  const apiRef = useRef({} as ScrollVisibilityApiType);
  useEffect(() => {
    if (!apiRef.current) {
      return () => {};
    }
    if (stripItems?.length > (itemsPrev?.length ?? 0)) {
      const id = setTimeout(() => {
        const item = apiRef.current.getItemById(activeKey);
        apiRef.current.scrollToItem(item, 'auto', 'end');
      }, 100);
      return () => clearTimeout(id);
    }
    const item = apiRef.current.getItemById(activeKey);
    if (!item?.visible) {
      apiRef.current.scrollToItem(item);
    }
    return () => {};
  }, [stripItems, itemsPrev, activeKey]);

  const fallbackDropId = useId();
  const stripScrollRef = useRef<HTMLDivElement | null>(null);
  const { ref: paneDropRef, isDropTarget } = useDroppable({
    id: paneId ?? fallbackDropId,
    disabled: !paneId,
    type: 'pane',
    accept: 'tab',
    // Numeric priorities (avoid bare @dnd-kit/abstract import under bundledDev).
    collisionPriority: 3,
    data: paneId ? { type: 'pane', paneId } : undefined,
  });

  const { ref: endDropRef, isDropTarget: isEndDropTarget } = useDroppable({
    id: paneId ? `${paneId}:end` : `${fallbackDropId}:end`,
    disabled: !paneId,
    type: 'pane-end',
    accept: 'tab',
    collisionPriority: 3,
    data: paneId ? { type: 'pane-end', paneId } : undefined,
  });

  // Auto-scroll tab strip when dragging near left/right edges.
  useEffect(() => {
    if (!activeTabId || !paneId) return;
    let raf = 0;
    const EDGE = 40;
    const SPEED = 10;
    const tick = (clientX: number) => {
      const el = stripScrollRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (clientX < rect.left || clientX > rect.right) return;
      if (clientX - rect.left < EDGE) {
        el.scrollLeft -= SPEED;
      } else if (rect.right - clientX < EDGE) {
        el.scrollLeft += SPEED;
      }
    };
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => tick(e.clientX));
    };
    window.addEventListener('pointermove', onMove);
    return () => {
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(raf);
    };
  }, [activeTabId, paneId]);

  const insertIndex = useMemo(() => {
    if (!paneId || !dropIndicator || dropIndicator.paneId !== paneId) {
      return null;
    }
    if (dropIndicator.index >= Number.MAX_SAFE_INTEGER / 2) {
      return stripItems.length;
    }
    return Math.max(0, Math.min(dropIndicator.index, stripItems.length));
  }, [dropIndicator, stripItems.length, paneId]);

  const tabsList = stripItems.map(({ tab }, index) => {
    return (
      <TabMenuItem
        key={paneId ? `${paneId}:${tab.id}` : tab.id}
        itemId={tab.id}
        index={index}
        paneId={paneId}
        paneFocused={paneFocused}
        showInsertBefore={insertIndex === index}
        isDragSource={activeTabId === tab.id}
        renderItem={renderItem}
        tab={tab}
        indicator={indicator}
        onRemove={onRemove}
      />
    );
  });

  // Keep panel DOM order stable so same-pane tab reorder does not remount Monaco.
  const contentItems = useMemo(
    () => [...items].sort((a, b) => a.tab.id.localeCompare(b.tab.id)),
    [items],
  );

  const showEndInsert =
    paneId != null && insertIndex === stripItems.length && stripItems.length > 0;

  return (
    <Tabs
      className="size-full justify-start items-stretch gap-0 flex flex-col"
      value={activeKey}
      onValueChange={onChange}
    >
      <div
        ref={(node) => {
          stripScrollRef.current = node;
          if (paneId) {
            paneDropRef(node);
          }
        }}
        data-tab-bar=""
        className={cn(
          'relative h-8 min-h-8 w-full overflow-x-auto overflow-y-hidden overscroll-x-contain',
          // Hide scrollbar chrome; wheel/trackpad still scrolls.
          '[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
          (isDropTarget || isEndDropTarget) &&
            insertIndex === null &&
            'bg-primary/10',
          !paneFocused && paneId && 'opacity-70',
        )}
      >
        <TabsList
          variant="line"
          className="p-0 h-8 border-b w-max max-w-none flex flex-row justify-stretch"
        >
          <ScrollMenu apiRef={apiRef} onWheel={onWheel}>
            {tabsList}
          </ScrollMenu>
        </TabsList>
        {paneId ? (
          <div
            ref={endDropRef}
            className={cn(
              'pointer-events-auto absolute inset-y-0 right-0 z-10 w-4',
              isEndDropTarget && 'bg-primary/10',
            )}
            aria-hidden
          >
            {showEndInsert ? <TabInsertLine side="before" /> : null}
          </div>
        ) : null}
        {paneId && items.length === 0 && insertIndex === 0 ? (
          <div className="absolute inset-y-0 left-2 w-8">
            <TabInsertLine side="before" />
          </div>
        ) : null}
      </div>
      {stripItems.length === 0 ? (
        <div className="flex-1 min-h-0 flex items-center justify-center text-muted-foreground text-sm">
          <Trans>No tabs in this pane</Trans>
        </div>
      ) : null}
      {contentItems.map(({ tab: { id }, children }) => {
        const isActive = id === activeKey;
        if (paneId) {
          return (
            <div
              key={id}
              role="tabpanel"
              hidden={!isActive}
              className={cn(
                'min-h-0 flex-1 overflow-hidden outline-none',
                !isActive && 'hidden',
              )}
            >
              <ErrorBoundary
                fallback={
                  <p>
                    <Trans>Something went wrong</Trans>
                  </p>
                }
              >
                {children}
              </ErrorBoundary>
            </div>
          );
        }
        return (
          <TabsContent
            key={id}
            value={id}
            keepMounted
            className="min-h-0"
          >
            <ErrorBoundary
              fallback={
                <p>
                  <Trans>Something went wrong</Trans>
                </p>
              }
            >
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

type TabItemMenuProps = {
  itemId: string;
  index: number;
  paneId?: string;
  paneFocused?: boolean;
  showInsertBefore?: boolean;
  isDragSource?: boolean;
  renderItem: (({ tab }: { tab: TabContextType }) => JSX.Element) | undefined;
  tab: TabContextType;
  indicator: string | undefined;
  onRemove: ((key: string) => void) | undefined;
};

function TabMenuItem({
  itemId,
  index,
  paneId,
  paneFocused = true,
  showInsertBefore = false,
  isDragSource = false,
  renderItem,
  tab,
  indicator,
  onRemove,
}: TabItemMenuProps) {
  const Comp = renderItem;
  const activateTab = useTabsStore((s) => s.active);
  const { ref, isDragging, isDropTarget } = useSortable({
    id: tab.id,
    index,
    group: paneId,
    type: 'tab',
    accept: ['tab', 'pane', 'pane-end', 'pane-body'],
    disabled: !paneId,
    plugins: [],
    collisionPriority: 4,
    data: {
      type: 'tab',
      tabId: tab.id,
      paneId,
    },
  });

  const dimmed = isDragging || isDragSource;

  return (
    <TabsTrigger
      id={paneId ? `tab-trigger-${paneId}-${tab.id}` : tab.id}
      key={tab.id}
      value={tab.id}
      data-cy={itemId}
      nativeButton={false}
      className={cn(
        'h-8 text-xs relative wm-200 pl-3 pr-1.5 rounded-none border-r cursor-pointer',
        'group',
        'data-[active]:shadow-none',
        'data-[active]:rounded-none',
        paneFocused
          ? 'data-[active]:bg-muted data-[active]:text-foreground'
          : 'data-[active]:bg-transparent data-[active]:text-muted-foreground',
        dimmed && 'opacity-30',
        isDropTarget && !showInsertBefore && 'bg-primary/10',
      )}
      onClick={() => {
        if (paneId) {
          activateTab(tab.id);
        }
      }}
      render={
        <div ref={paneId ? ref : undefined} className="relative cursor-pointer overflow-visible">
          {showInsertBefore ? <TabInsertLine side="before" /> : null}
          <div
            className={cn(
              'h-0.5 w-full absolute left-0 invisible z-6',
              paneFocused ? 'bg-foreground' : 'bg-muted-foreground/50',
              'group-data-[active]:visible',
              {
                'bottom-0': indicator != 'top',
                'top-0': indicator == 'top',
              },
              `${indicator ?? 'bottom'}-0`,
            )}
          />
          {Comp ? (
            <Comp tab={tab} />
          ) : (
            <SimpleTab tab={tab} onRemove={onRemove as (s: string) => void} />
          )}
        </div>
      }
    ></TabsTrigger>
  );
}

export function CloseableItem({ tab, onRemove }: TabItemProps) {
  const { t } = useLingui();
  const typeLabel =
    tab.type === 'search'
      ? t`Search`
      : tab.type === 'editor'
        ? t`Editor`
        : tab.type === 'table'
          ? t`Table`
          : tab.type === 'schema'
            ? t`Schema`
            : tab.type === 'query'
              ? t`Query`
              : tab.type;

  return (
    <div className="flex items-center justify-between">
      <TitleTooltip title={`${typeLabel}: ${tab.displayName}`}>
        <div className="flex">
          <TabTypeIcon type={tab.type} className="size-4 mr-1" />
          <div className="max-w-52 truncate">{tab.displayName}</div>
        </div>
      </TitleTooltip>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'rounded-lg size-5 invisible ml-1',
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
        <XIcon className="size-5 p-0.5" />
      </Button>
    </div>
  );
}

export function SimpleTab({ tab, onRemove }: TabItemProps) {
  return (
    <>
      <span>{tab.displayName}</span>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'rounded-lg size-5 invisible ml-1',
          'group-hover:visible',
          'group-data-[state=active]:visible',
          'hover:bg-selection',
        )}
        onPointerDown={(e) => {
          e.stopPropagation();
          onRemove?.(tab.id);
        }}
      >
        <XIcon className="size-5 p-0.5" />
      </Button>
    </>
  );
}

function RenameDialog({
  id,
  open,
  onOpenChange,
}: Pick<React.ComponentProps<typeof Dialog>, 'open' | 'onOpenChange'> & {
  id: string;
}) {
  const displayName = useTabsStore((s) => s.tabs[id]?.displayName);
  const patch = useTabsStore((s) => s.patch);

  const handleSubmit = ({ name }: { name: string }) => {
    patch(id, { displayName: name });
    onOpenChange?.(false);
  };

  const form = useForm<{ name: string }>({
    defaultValues: { name: displayName },
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={<Trans>Rename</Trans>}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Name</Trans>
                </FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
              </FormItem>
            )}
          />

          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange?.(false)}>
              <Trans>Cancel</Trans>
            </Button>
            <Button type="submit">
              <Trans>Ok</Trans>
            </Button>
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
  const onClick = () => visibility.scrollToItem(visibility.getPrevElement(), 'smooth', 'start');

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
  const onClick = () => visibility.scrollToItem(visibility.getNextElement(), 'smooth', 'end');

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

const ArrowButton = (props: React.ComponentProps<typeof Button>) => (
  <Button
    {...props}
    className={cn(
      'pointer flex w-6 flex-col justify-center select-none border-r-2 border',
      props.disabled ? 'opacity-0' : 'opacity-100',
    )}
  />
);
