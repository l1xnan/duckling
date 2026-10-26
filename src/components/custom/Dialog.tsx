import { ReactNode, ReactElement } from 'react'

import {
  DialogContent,
  DialogHeader,
  Dialog as DialogRoot,
  DialogTitle,
  DialogTrigger,
} from '@/components/custom/ui/dialog'
import { DialogResizeHandles } from '@/components/custom/DialogResizeHandles'
import {
  useDialogResize,
  type DialogResizeOptions,
} from '@/hooks/useDialogResize'
import { cn } from '@/lib/utils'

const CONTENT_CLASS =
  'grid grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden'

interface DialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  title: ReactNode
  className?: string
  children: ReactNode
  trigger?: ReactElement
  resizable?: DialogResizeOptions
}

const ResizableDialogContent = ({
  className,
  options,
  children,
}: {
  className?: string
  options: DialogResizeOptions
  children: ReactNode
}) => {
  const { style, handlers } = useDialogResize(options)

  return (
    <DialogContent
      className={cn(
        CONTENT_CLASS,
        'max-h-none max-w-none sm:max-w-none',
        className,
      )}
      style={style}
    >
      {children}
      <DialogResizeHandles {...handlers} />
    </DialogContent>
  )
}

export const Dialog = ({
  open,
  onOpenChange,
  title,
  trigger,
  children,
  className,
  resizable,
}: DialogProps) => {
  const content = (
    <>
      <DialogHeader className="h-5 shrink-0">
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      {children}
    </>
  )

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange} disablePointerDismissal>
      {trigger ? <DialogTrigger render={trigger} /> : null}
      {resizable ? (
        <ResizableDialogContent className={className} options={resizable}>
          {content}
        </ResizableDialogContent>
      ) : (
        <DialogContent
          className={cn(CONTENT_CLASS, 'max-h-[min(90vh,720px)]', className)}
        >
          {content}
        </DialogContent>
      )}
    </DialogRoot>
  )
}

export default Dialog
