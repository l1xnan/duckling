import { Button, ButtonProps } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import React, { PropsWithChildren, ReactElement } from 'react';

interface IconButtonProps extends PropsWithChildren<ButtonProps> {
  icon: ReactElement;
  tooltip?: string;
}

export const TooltipButton = ({
  tooltip,
  icon,
  children,
  className,
  ...props
}: IconButtonProps) => {
  const elem = icon ?? React.Children.only(children);
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
            className={cn('size-8 h-8 w-8 rounded-lg', className)}
            {...props}
          >
            {element}
          </Button>
        </TooltipTrigger>
        {tooltip ? <TooltipContent>{tooltip}</TooltipContent> : null}
      </Tooltip>
    </TooltipProvider>
  );
};
