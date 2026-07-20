import { Button as UIButton, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Compact Button overrides:
 *   default: h-9 → h-8, icon: size-9 → size-8
 *   sm: h-8 → h-7, icon-sm: size-8 → size-7
 *   lg: h-10 → h-9, icon-lg: size-10 → size-9
 */
const compactOverrides: Record<string, string> = {
  default: 'h-8',
  sm: 'h-7',
  lg: 'h-9',
  icon: 'size-8',
  'icon-sm': 'size-7',
  'icon-lg': 'size-9',
};

function Button({
  className,
  size = 'default',
  ...props
}: React.ComponentProps<typeof UIButton>) {
  return (
    <UIButton
      className={cn(compactOverrides[size ?? 'default'], className)}
      size={size}
      {...props}
    />
  );
}

export { Button, buttonVariants };
