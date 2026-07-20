import {
  Form,
  FormControl,
  FormDescription as UIFormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage as UIFormMessage,
  useFormField,
} from '@/components/ui/form';
import { cn } from '@/lib/utils';

/**
 * Compact FormDescription/FormMessage overrides:
 *   text-sm → text-xs.
 */
function FormDescription({
  className,
  ...props
}: React.ComponentProps<typeof UIFormDescription>) {
  return <UIFormDescription className={cn('text-xs', className)} {...props} />;
}

function FormMessage({
  className,
  ...props
}: React.ComponentProps<typeof UIFormMessage>) {
  return <UIFormMessage className={cn('text-xs', className)} {...props} />;
}

export {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useFormField,
};
