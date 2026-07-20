import { Input as UIInput } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * Compact Input overrides:
 *   h-9 → h-8, text-base → text-sm, remove focus ring glow.
 */
function Input({ className, ...props }: React.ComponentProps<typeof UIInput>) {
  return (
    <UIInput
      className={cn(
        'h-8 text-sm md:text-sm focus-visible:ring-0 focus-visible:ring-offset-0',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
