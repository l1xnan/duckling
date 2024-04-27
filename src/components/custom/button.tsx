import { Button, ButtonProps } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { TooltipContentProps } from '@radix-ui/react-tooltip';
import React, { PropsWithChildren, ReactElement } from 'react';

interface IconButtonProps extends PropsWithChildren<ButtonProps> {
  icon?: ReactElement;
  tooltip?: string;
  tooltipProps?: TooltipContentProps;
}

export const TooltipButton = ({
  tooltip,
  icon,
  children,
  className,
  tooltipProps,
  ...props
}: IconButtonProps) => {
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
            className={cn('size-6 rounded-lg', className)}
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
};
