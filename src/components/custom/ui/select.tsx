import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem as UISelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger as UISelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

/**
 * Compact SelectTrigger overrides:
 *   default h-9 → h-8, sm h-8 → h-7, remove focus ring glow.
 */
function SelectTrigger({
  className,
  size = 'default',
  ...props
}: React.ComponentProps<typeof UISelectTrigger>) {
  return (
    <UISelectTrigger
      className={cn(
        'focus-visible:ring-0 focus-visible:ring-offset-0',
        size === 'default' && 'h-8',
        size === 'sm' && 'h-7',
        className,
      )}
      size={size}
      {...props}
    />
  );
}

/**
 * Compact SelectItem overrides:
 *   py-1.5 → py-1.
 */
function SelectItem({
  className,
  ...props
}: React.ComponentProps<typeof UISelectItem>) {
  return (
    <UISelectItem className={cn('py-1', className)} {...props} />
  );
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
