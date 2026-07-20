import {
  Dialog,
  DialogClose,
  DialogContent as UIDialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

/**
 * Compact DialogContent overrides:
 *   p-6 → p-5, gap-6 → gap-4.
 */
function DialogContent({
  className,
  ...props
}: React.ComponentProps<typeof UIDialogContent>) {
  return (
    <UIDialogContent
      className={cn('p-5 gap-4', className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
