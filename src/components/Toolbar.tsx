import { cn } from '@/lib/utils';
import React from 'react';

export const ToolbarContainer = ({
  children,
  className,
  contentClassName,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { contentClassName?: string }) => (
  <div
    className={cn(
      'min-h-8 min-w-0 w-full shrink-0 overflow-x-auto overflow-y-hidden border-b [scrollbar-width:thin]',
      className,
    )}
    {...props}
  >
    <div
      className={cn(
        'flex h-8 min-w-max items-center justify-between gap-2 pl-1',
        contentClassName,
      )}
    >
      {children}
    </div>
  </div>
);

export const ToolbarBox = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex h-8 min-w-max flex-1 items-center justify-between gap-2',
      className,
    )}
    {...props}
  />
);

export const Stack = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>((props, ref) => {
  return (
    <div
      {...props}
      className={cn(
        'flex shrink-0 flex-row gap-1 h-full items-center justify-start',
        props.className,
      )}
      ref={ref}
    />
  );
});
