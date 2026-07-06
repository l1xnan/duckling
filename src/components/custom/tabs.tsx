import { Tabs as TabsPrimitive } from '@base-ui/react/tabs'
import * as React from 'react'

import { cn } from '@/lib/utils'

function VTabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      orientation="vertical"
      className={cn(
        'flex rounded-md p-1 border-3 border-white text-muted-foreground gap-1',
        className,
      )}
      {...props}
    />
  )
}

function VTabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        'flex flex-col h-auto items-center justify-start rounded-md bg-muted p-1 text-muted-foreground',
        className,
      )}
      {...props}
    />
  )
}

function VTabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Tab>) {
  return (
    <TabsPrimitive.Tab
      className={cn(
        'flex items-center justify-start whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[active]:bg-background data-[active]:text-foreground data-[active]:shadow-sm',
        className,
      )}
      {...props}
    />
  )
}

function VTabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Panel>) {
  return (
    <TabsPrimitive.Panel
      className={cn(
        'ml-4 mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className,
      )}
      {...props}
    />
  )
}

export { VTabs, VTabsContent, VTabsList, VTabsTrigger }
