import { ReactNode, ReactElement } from 'react'

import {
  DialogContent,
  DialogHeader,
  Dialog as DialogRoot,
  DialogTitle,
  DialogTrigger,
} from '@/components/custom/ui/dialog'
import { cn } from '@/lib/utils'

interface DialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  title: ReactNode
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
        className={cn(
          'grid max-h-[min(90vh,720px)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden',
          className,
        )}
      >
        <DialogHeader className="h-5 shrink-0">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </DialogRoot>
  )
}

export default Dialog
