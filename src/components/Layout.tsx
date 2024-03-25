import React from 'react';

import { cn } from '@/lib/utils';

export interface WrapperProps extends React.HTMLAttributes<HTMLDivElement> {}

const Content = React.forwardRef<HTMLDivElement, WrapperProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        className={cn(
          'flex flex-col flex-grow overflow-hidden h-full',
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);

Content.displayName = 'Content';

const Sidebar = React.forwardRef<HTMLDivElement, WrapperProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        className={cn(
          'flex-shrink-0 w-full overflow-hidden border-r',
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);

Sidebar.displayName = 'Sidebar';

export { Content, Sidebar };
