import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ReactNode } from 'react';

import {
  DialogContent,
  DialogHeader,
  Dialog as DialogRoot,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface DialogProps extends DialogPrimitive.DialogProps {
  title: string;
  className?: string;
  children: ReactNode;
  trigger?: ReactNode;
}

export const Dialog = ({
  open,
  onOpenChange,
  title,
  trigger,
  children,
  className,
}: DialogProps) => {
  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent
        className={cn('grid-rows-[auto_1fr]', className)}
        onInteractOutside={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <DialogHeader className="h-5">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </DialogRoot>
  );
};

export default Dialog;
