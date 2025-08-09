import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { TooltipProviderProps } from '@radix-ui/react-tooltip';
import React, {
  PropsWithChildren,
  ReactElement,
  ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  Tooltip as ITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { cn } from '@/lib/utils';
import { Button } from '../ui/button';

export function Tooltip({
  children,
  title,
}: PropsWithChildren<{ title: ReactNode } & TooltipProviderProps>) {
  return (
    <TooltipProvider
      delayDuration={1500}
      skipDelayDuration={1000}
      disableHoverableContent={true}
    >
      <ITooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipPrimitive.Portal>
          <TooltipContent
            side="bottom"
            align="start"
            // className="bg-popover text-popover-foreground border"
          >
            {title}
          </TooltipContent>
        </TooltipPrimitive.Portal>
      </ITooltip>
    </TooltipProvider>
  );
}

interface DelayedTooltipProps extends PropsWithChildren {
  content: React.ReactNode;
  delay?: number;
}

export function DelayedTooltip({
  children,
  content,
  delay = 1000,
}: DelayedTooltipProps) {
  const [open, setOpen] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const hoverTimeRef = useRef(0);

  const handleOpen = () => {
    hoverTimeRef.current = Date.now();
    timerRef.current = setTimeout(() => {
      setOpen(true);
    }, delay);
  };

  const handleClose = () => {
    setOpen(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <ITooltip open={open}>
      <TooltipTrigger
        asChild
        onMouseEnter={handleOpen}
        onMouseLeave={handleClose}
        onTouchStart={handleOpen}
        onTouchEnd={handleClose}
      >
        {children}
      </TooltipTrigger>
      {content ? (
        <TooltipContent side="bottom" align="start">
          {content}
        </TooltipContent>
      ) : null}
    </ITooltip>
  );
}

interface IconButtonProps
  extends PropsWithChildren<React.ComponentProps<typeof Button>> {
  icon?: ReactElement;
  tooltip?: string;
  tooltipProps?: TooltipPrimitive.TooltipContentProps;
  active?: boolean;
}
export const TooltipButton = React.forwardRef<
  HTMLButtonElement,
  IconButtonProps
>(({ tooltip, icon, children, className, active, ...props }, ref) => {
  return (
    <DelayedTooltip content={tooltip}>
      <Button
        variant="ghost"
        size="icon"
        className={cn('size-6 rounded-lg [&>*]:size-4', className, {
          'bg-muted': active,
        })}
        ref={ref}
        {...props}
      >
        {icon ?? children}
      </Button>
    </DelayedTooltip>
  );
});
