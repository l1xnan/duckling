import { cn } from '@/lib/utils';
import {
  ItemInstance,
  TreeInstance,
  expandAllFeature,
  hotkeysCoreFeature,
  searchFeature,
  selectionFeature,
  syncDataLoaderFeature,
} from '@headless-tree/core';
import { useTree } from '@headless-tree/react';
import { Virtualizer, useVirtualizer } from '@tanstack/react-virtual';
import { ChevronRight } from 'lucide-react';
import React, {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

const Node = React.memo(
  ({
    tree,
    item,
    style,
  }: {
    tree: TreeInstance<string>;
    item: ItemInstance<string>;
    style: React.CSSProperties;
  }) => {
    const { onClick, ...props } = item.getProps();
    const rowAttrs: React.HTMLAttributes<any> = {
      role: 'treeitem',
      'aria-expanded': item.isExpanded(),
    };

    return (
      <div
        key={item.getId()}
        onDoubleClick={onClick}
        onClick={() => {
          tree.setSelectedItems([item.getItemMeta().itemId]);
        }}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          ...style,
        }}
        {...rowAttrs}
        {...props}
        className={cn(
          'group',
          'relative',
          'transition-colors',
          'flex items-center gap-1',
          'text-sm',
          'cursor-pointer',
          'select-none',
          'text-foreground',
          'hover:bg-accent',
          'aria-selected:bg-selection',
          'aria-selected:hover:bg-selection',
          'h-[22px]',
        )}
      >
        {item.isFolder() ? (
          <ChevronRight
            onClick={onClick}
            className={cn(
              'text-foreground-muted',
              'transition-transform duration-200',
              'size-4',
              'group-aria-expanded:rotate-90',
            )}
          />
        ) : (
          <div className="size-4 min-w-4"></div>
        )}
        <button
          {...props}
          ref={item.registerElement}
          className={cn('treeitem')}
        >
          {item.getItemName()}
        </button>
      </div>
    );
  },
);

const Inner = forwardRef<Virtualizer<HTMLDivElement, Element>, any>(
  ({ tree }: { tree: TreeInstance<string> }, ref) => {
    const parentRef = useRef<HTMLDivElement | null>(null);

    const virtualizer = useVirtualizer({
      count: tree.getItems().length,
      getScrollElement: () => parentRef.current,
      estimateSize: () => 22,
    });

    useImperativeHandle(ref, () => virtualizer);

    return (
      <div ref={parentRef} className="h-full overflow-x-hidden">
        <div
          ref={tree.registerElement}
          className={cn('tree size-full relative')}
          style={{ height: `${virtualizer.getTotalSize()}px` }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const item = tree.getItems()[virtualItem.index];
            const style = {
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualItem.start}px)`,
              paddingLeft: `${item.getItemMeta().level * 16}px`,
            } as React.CSSProperties;

            const rowAttrs: React.HTMLAttributes<any> = {
              role: 'treeitem',
              'aria-expanded': item.isExpanded(),
              style,
            };
            return (
              <Node key={item.getId()} tree={tree} item={item} style={style} />
            );
          })}
        </div>
      </div>
    );
  },
);

export const TreeView3 = ({ data }) => {
  console.log(data);
  const virtualizer = useRef<Virtualizer<HTMLDivElement, Element> | null>(null);

  const [dataLoader] = useMemo(() => createDemoData(), []);

  const [state, setState] = useState({});
  const tree = useTree<string>({
    // state,
    // setState,
    rootItemId: 'root',
    getItemName: (item) => item.getItemData()?.name,
    isItemFolder: (item) => !!item.getItemData()?.children,
    scrollToItem: (item) => {
      virtualizer.current?.scrollToIndex(item.getItemMeta().index);
    },
    dataLoader,
    features: [
      syncDataLoaderFeature,
      selectionFeature,
      hotkeysCoreFeature,
      searchFeature,
      expandAllFeature,
    ],
  });

  return <Inner tree={tree} ref={virtualizer} />;
};

export type DemoItem = {
  name: string;
  children?: string[];
};

export const createDemoData = () => {
  const data: Record<string, DemoItem> = {
    root: {
      name: 'Root',
      children: ['fruit', 'vegetables', 'meals', 'dessert', 'drinks'],
    },
    fruit: {
      name: 'Fruit',
      children: ['apple', 'banana', 'orange', 'berries'],
    },
    apple: { name: 'Apple' },
    banana: { name: 'Banana' },
    orange: { name: 'Orange' },
    berries: { name: 'Berries', children: ['red', 'blue', 'black'] },
    red: { name: 'Red', children: ['strawberry', 'raspberry'] },
    strawberry: { name: 'Strawberry' },
    raspberry: { name: 'Raspberry' },
    blue: { name: 'Blue', children: ['blueberry'] },
    blueberry: { name: 'Blueberry' },
    black: { name: 'Black', children: ['blackberry'] },
    blackberry: { name: 'Blackberry' },
    vegetables: {
      name: 'Vegetables',
      children: ['tomato', 'carrot', 'cucumber', 'potato'],
    },
    tomato: { name: 'Tomato' },
    carrot: { name: 'Carrot' },
    cucumber: { name: 'Cucumber' },
    potato: { name: 'Potato' },
    meals: {
      name: 'Meals',
      children: ['america', 'europe', 'asia', 'australia'],
    },
    america: { name: 'America', children: ['burger', 'hotdog', 'pizza'] },
    burger: { name: 'Burger' },
    hotdog: { name: 'Hotdog' },
    pizza: { name: 'Pizza' },
    europe: {
      name: 'Europe',
      children: ['pasta', 'paella', 'schnitzel', 'risotto', 'weisswurst'],
    },
    pasta: { name: 'Pasta' },
    paella: { name: 'Paella' },
    schnitzel: { name: 'Schnitzel' },
    risotto: { name: 'Risotto' },
    weisswurst: { name: 'Weisswurst' },
    asia: { name: 'Asia', children: ['sushi', 'ramen', 'curry', 'noodles'] },
    sushi: { name: 'Sushi' },
    ramen: { name: 'Ramen' },
    curry: { name: 'Curry' },
    noodles: { name: 'Noodles' },
    australia: {
      name: 'Australia',
      children: ['potatowedges', 'pokebowl', 'lemoncurd', 'kumarafries'],
    },
    potatowedges: { name: 'Potato Wedges' },
    pokebowl: { name: 'Poke Bowl' },
    lemoncurd: { name: 'Lemon Curd' },
    kumarafries: { name: 'Kumara Fries' },
    dessert: {
      name: 'Dessert',
      children: ['icecream', 'cake', 'pudding', 'cookies'],
    },
    icecream: { name: 'Icecream' },
    cake: { name: 'Cake' },
    pudding: { name: 'Pudding' },
    cookies: { name: 'Cookies' },
    drinks: { name: 'Drinks', children: ['water', 'juice', 'beer', 'wine'] },
    water: { name: 'Water' },
    juice: { name: 'Juice' },
    beer: { name: 'Beer' },
    wine: { name: 'Wine' },
  };

  const dataLoader = {
    getItem: (id: string) => data[id],
    getChildren: (id: string) => data[id]?.children ?? [],
  };

  return [dataLoader, data] as const;
};
