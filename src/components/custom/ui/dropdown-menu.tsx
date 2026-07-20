import {
  DropdownMenu,
  DropdownMenuCheckboxItem as UIDropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem as UIDropdownMenuItem,
  DropdownMenuLabel as UIDropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem as UIDropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger as UIDropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

/** Compact: py-1.5 text-sm → py-1 text-xs */
function DropdownMenuItem({
  className,
  ...props
}: React.ComponentProps<typeof UIDropdownMenuItem>) {
  return <UIDropdownMenuItem className={cn('py-1 text-xs', className)} {...props} />;
}

function DropdownMenuLabel({
  className,
  ...props
}: React.ComponentProps<typeof UIDropdownMenuLabel>) {
  return <UIDropdownMenuLabel className={cn('text-xs', className)} {...props} />;
}

function DropdownMenuSubTrigger({
  className,
  ...props
}: React.ComponentProps<typeof UIDropdownMenuSubTrigger>) {
  return <UIDropdownMenuSubTrigger className={cn('py-1 text-xs', className)} {...props} />;
}

function DropdownMenuCheckboxItem({
  className,
  ...props
}: React.ComponentProps<typeof UIDropdownMenuCheckboxItem>) {
  return <UIDropdownMenuCheckboxItem className={cn('py-1 text-xs', className)} {...props} />;
}

function DropdownMenuRadioItem({
  className,
  ...props
}: React.ComponentProps<typeof UIDropdownMenuRadioItem>) {
  return <UIDropdownMenuRadioItem className={cn('py-1 text-xs', className)} {...props} />;
}

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
};
