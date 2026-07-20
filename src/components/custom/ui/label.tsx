import { Label as UILabel } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/**
 * Compact Label overrides:
 *   text-sm → text-xs, gap-2 → gap-1.5, leading-none → leading-tight.
 */
function Label({ className, ...props }: React.ComponentProps<typeof UILabel>) {
  return (
    <UILabel
      className={cn('gap-1.5 text-xs leading-tight', className)}
      {...props}
    />
  );
}

export { Label };
