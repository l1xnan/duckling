import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip';
import React, {
  PropsWithChildren,
  ReactElement,
  ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { Button } from '@/components/custom/ui/button';
import { cn } from '@/lib/utils';

export function TitleTooltip({
  children,
  title,
}: PropsWithChildren<
  { title: ReactNode } & React.ComponentProps<typeof TooltipPrimitive.Provider>
>) {
  return (
    <TooltipProvider delay={1500} closeDelay={1000}>
      <Tooltip disableHoverablePopup={true}>
        <TooltipTrigger render={children as React.ReactElement}></TooltipTrigger>
        {/* <TooltipPrimitive.Portal> */}
        <TooltipContent
          side="bottom"
          align="start"
          // className="bg-popover text-popover-foreground border"
        >
          {title}
        </TooltipContent>
        {/* </TooltipPrimitive.Portal> */}
      </Tooltip>
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
    <Tooltip open={open}>
      <TooltipTrigger
        onMouseEnter={handleOpen}
        onMouseLeave={handleClose}
        onTouchStart={handleOpen}
        onTouchEnd={handleClose}
        render={children as React.ReactElement}
      >
      </TooltipTrigger>
      {content ? (
        <TooltipContent side="bottom" align="start">
          {content}
        </TooltipContent>
      ) : null}
    </Tooltip>
  );
}

interface IconButtonProps extends PropsWithChildren<
  React.ComponentProps<typeof Button>
> {
  icon?: ReactElement;
  tooltip?: string;
  tooltipProps?: TooltipPrimitive.Popup.Props;
  active?: boolean;

  ref?: React.Ref<HTMLButtonElement>;
}

export function TooltipButton({
  tooltip,
  tooltipProps: _tooltipProps,
  icon,
  children,
  className,
  active,
  ref,
  ...props
}: IconButtonProps) {
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
}
