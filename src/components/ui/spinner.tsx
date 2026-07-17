import { msg } from '@lingui/core/macro'
import { cn } from "@/lib/utils"
import { i18n } from '@/i18n'
import { Loader2Icon } from "lucide-react"

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <Loader2Icon data-slot="spinner" role="status" aria-label={i18n._(msg`Loading`)} className={cn("size-4 animate-spin", className)} {...props} />
  )
}

export { Spinner }
