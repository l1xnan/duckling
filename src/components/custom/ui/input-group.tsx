import {
  InputGroup as UInputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from '@/components/ui/input-group';
import { cn } from '@/lib/utils';

/**
 * Compact InputGroup overrides:
 *   h-9 → h-8, remove focus ring glow.
 */
function InputGroup({
  className,
  ...props
}: React.ComponentProps<typeof UInputGroup>) {
  return (
    <UInputGroup
      className={cn(
        'h-8 focus-within:ring-0 focus-within:ring-offset-0',
        className,
      )}
      {...props}
    />
  );
}

export {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
};
