import { TooltipProviderProps } from '@radix-ui/react-tooltip';
import { PropsWithChildren, ReactNode } from 'react';

import {
  Tooltip as ITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function Tooltip({
  children,
  title,
}: PropsWithChildren<{ title: ReactNode } & TooltipProviderProps>) {
  return (
    <TooltipProvider delayDuration={1500} skipDelayDuration={1000}>
      <ITooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="start"
          className="bg-popover text-popover-foreground border"
        >
          {title}
        </TooltipContent>
      </ITooltip>
    </TooltipProvider>
  );
}
