import {
  ContextMenu,
  ContextMenuCheckboxItem as UIContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem as UIContextMenuItem,
  ContextMenuLabel,
  ContextMenuPortal,
  ContextMenuRadioGroup,
  ContextMenuRadioItem as UIContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger as UIContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { cn } from '@/lib/utils';

/** Compact: py-1.5 text-sm → py-1 text-xs */
function ContextMenuItem({
  className,
  ...props
}: React.ComponentProps<typeof UIContextMenuItem>) {
  return <UIContextMenuItem className={cn('py-1 text-xs', className)} {...props} />;
}

function ContextMenuSubTrigger({
  className,
  ...props
}: React.ComponentProps<typeof UIContextMenuSubTrigger>) {
  return <UIContextMenuSubTrigger className={cn('py-1 text-xs', className)} {...props} />;
}

function ContextMenuCheckboxItem({
  className,
  ...props
}: React.ComponentProps<typeof UIContextMenuCheckboxItem>) {
  return <UIContextMenuCheckboxItem className={cn('py-1 text-xs', className)} {...props} />;
}

function ContextMenuRadioItem({
  className,
  ...props
}: React.ComponentProps<typeof UIContextMenuRadioItem>) {
  return <UIContextMenuRadioItem className={cn('py-1 text-xs', className)} {...props} />;
}

export {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuPortal,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
};
