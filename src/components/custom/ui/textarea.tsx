import { Textarea as UITextarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

/**
 * Compact Textarea overrides:
 *   min-h-16 → min-h-14, text-base → text-sm, remove focus ring glow.
 */
function Textarea({ className, ...props }: React.ComponentProps<typeof UITextarea>) {
  return (
    <UITextarea
      className={cn(
        'min-h-14 text-sm md:text-sm focus-visible:ring-0 focus-visible:ring-offset-0',
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
