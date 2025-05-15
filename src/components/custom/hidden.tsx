import { cn } from '@/lib/utils';
import { PropsWithChildren } from 'react';

export const Hidden = ({
                         display,
                         children,
                         className,
                       }: PropsWithChildren<{ display: boolean; className?: string }>) => (
  <div className={cn('size-full', className, display ? '' : 'hidden')}>
    {children}
  </div>
);
