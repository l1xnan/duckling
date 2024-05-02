import { cn } from '@/lib/utils';
import React from 'react';

export const ToolbarContainer = (
  props: React.HTMLAttributes<HTMLDivElement>,
) => (
  <div
    className="h-8 min-h-8 w-full pl-1 flex flex-row items-center justify-between border-b"
    {...props}
  />
);

export const ToolbarBox = (props: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className="flex flex-row items-center justify-between w-full h-8"
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
        'flex flex-row gap-1 h-full items-center justify-start',
        props.className,
      )}
      ref={ref}
    />
  );
});
