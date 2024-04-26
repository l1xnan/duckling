import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ReactNode } from 'react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
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

export default ({
  open,
  onOpenChange,
  title,
  trigger,
  children,
  className,
}: DialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent
        className={cn('grid-rows-[auto_1fr]', className)}
        onInteractOutside={(e) => {
          e.preventDefault();
          e.stopPropagation();

        }}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
      >
        <DialogHeader className="h-5">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
};
