import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import React, { PropsWithChildren, ReactElement } from 'react';

interface IconButtonProps extends PropsWithChildren<
  React.ComponentProps<typeof Button>
> {
  icon?: ReactElement;
  tooltip?: string;
  tooltipProps?: React.ComponentProps<typeof TooltipContent>;
  active?: boolean;
}

export const TooltipButton = React.forwardRef<
  HTMLButtonElement,
  IconButtonProps
>(
  (
    { tooltip, icon, children, className, tooltipProps, active, ...props },
    ref,
  ) => {
    const elem = icon ?? (React.Children.only(children) as ReactElement);
    const element = React.cloneElement(elem, {
      className: cn('size-4', elem.props?.className),
    });
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn('size-6 rounded-lg [&>*]:size-4', className, {
                'bg-muted': active,
              })}
              ref={ref}
              {...props}
            >
              {element}
            </Button>
          </TooltipTrigger>
          {tooltip ? (
            <TooltipContent {...(tooltipProps ?? {})}>{tooltip}</TooltipContent>
          ) : null}
        </Tooltip>
      </TooltipProvider>
    );
  },
);
