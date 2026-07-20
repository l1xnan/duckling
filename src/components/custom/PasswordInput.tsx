import { EyeIcon, EyeOffIcon } from 'lucide-react';
import * as React from 'react';

import { Input } from '@/components/custom/ui/input';
import { cn } from '@/lib/utils';

export type PasswordInputProps = Omit<
  React.ComponentProps<'input'>,
  'type'
> & {
  showToggleLabel?: string;
  hideToggleLabel?: string;
};

export const PasswordInput = React.forwardRef<
  HTMLInputElement,
  PasswordInputProps
>(function PasswordInput(
  {
    className,
    showToggleLabel = 'Show password',
    hideToggleLabel = 'Hide password',
    disabled,
    ...props
  },
  ref,
) {
  const [visible, setVisible] = React.useState(false);

  return (
    <div className={cn('relative w-full', className)}>
      <Input
        ref={ref}
        type={visible ? 'text' : 'password'}
        disabled={disabled}
        className="pr-9"
        {...props}
      />
      <button
        type="button"
        disabled={disabled}
        className="absolute top-1/2 right-0.5 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground outline-none hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
        aria-label={visible ? hideToggleLabel : showToggleLabel}
        aria-pressed={visible}
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
      >
        {visible ? (
          <EyeOffIcon className="size-4" />
        ) : (
          <EyeIcon className="size-4" />
        )}
      </button>
    </div>
  );
});
