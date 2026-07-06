import { ReactNode, ReactElement } from 'react'

import {
  DialogContent,
  DialogHeader,
  Dialog as DialogRoot,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface DialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  title: string
  className?: string
  children: ReactNode
  trigger?: ReactElement
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
    <DialogRoot open={open} onOpenChange={onOpenChange} disablePointerDismissal>
      {trigger ? <DialogTrigger render={trigger} /> : null}
      <DialogContent
        className={cn('grid-rows-[auto_1fr]', className)}
      >
        <DialogHeader className="h-5">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </DialogRoot>
  )
}

export default Dialog
