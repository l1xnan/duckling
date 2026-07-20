import {
  Field as UIField,
  FieldContent,
  FieldDescription as UIFieldDescription,
  FieldError as UIFieldError,
  FieldGroup as UIFieldGroup,
  FieldLabel,
  FieldSeparator,
  FieldSet as UIFieldSet,
  FieldTitle as UIFieldTitle,
} from '@/components/ui/field';
import { cn } from '@/lib/utils';

/** FieldSet: gap-6 → gap-4 */
function FieldSet({ className, ...props }: React.ComponentProps<typeof UIFieldSet>) {
  return <UIFieldSet className={cn('gap-4', className)} {...props} />;
}

/** FieldGroup: gap-7 → gap-4 */
function FieldGroup({ className, ...props }: React.ComponentProps<typeof UIFieldGroup>) {
  return <UIFieldGroup className={cn('gap-4', className)} {...props} />;
}

/** FieldTitle: text-sm → text-xs */
function FieldTitle({ className, ...props }: React.ComponentProps<typeof UIFieldTitle>) {
  return <UIFieldTitle className={cn('text-xs', className)} {...props} />;
}

/** FieldDescription: text-sm → text-xs */
function FieldDescription({
  className,
  ...props
}: React.ComponentProps<typeof UIFieldDescription>) {
  return <UIFieldDescription className={cn('text-xs', className)} {...props} />;
}

/** FieldError: text-sm → text-xs */
function FieldError({ className, ...props }: React.ComponentProps<typeof UIFieldError>) {
  return <UIFieldError className={cn('text-xs', className)} {...props} />;
}

export {
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
  FieldSet,
  FieldTitle,
  UIField as Field,
};
