import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ReactNode } from 'react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface DialogProps extends DialogPrimitive.DialogProps {
  title: string;
  children: ReactNode;
  trigger?: ReactNode;
}

export default ({
  open,
  onOpenChange,
  title,
  trigger,
  children,
}: DialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent
        className="min-w-[800px] min-h-[600px] grid-rows-[auto_1fr]"
        onInteractOutside={(e) => {
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
