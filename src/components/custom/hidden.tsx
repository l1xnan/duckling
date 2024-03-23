import { cn } from '@/lib/utils.ts';
import { PropsWithChildren } from 'react';

export const Hidden = ({
  display,
  children,
  className,
}: PropsWithChildren<{ display: boolean; className?: string }>) => (
  <div className={cn(className, display ? '' : 'hidden')}>{children}</div>
);
