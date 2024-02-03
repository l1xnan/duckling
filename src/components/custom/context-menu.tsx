import { LucideIcon } from 'lucide-react';

import {
  ContextMenuShortcut,
  ContextMenuItem as UIContextMenuItem,
} from '@/components/ui/context-menu';

import type { ComponentProps, ReactNode } from 'react';

interface ContextMenuItemProps
  extends ComponentProps<typeof UIContextMenuItem> {
  icon?: LucideIcon;
  shortcut?: string;
  children: ReactNode | string;
}

export function ContextMenuItem({
  shortcut,
  icon: IconComponent,
  ...props
}: ContextMenuItemProps) {
  return (
    <UIContextMenuItem
      className="py-1 text-xs"
      inset={!IconComponent}
      {...props}
    >
      {IconComponent ? <IconComponent size={14} className="mr-2.5" /> : null}
      {props.children}
      {shortcut ? <ContextMenuShortcut>{shortcut}</ContextMenuShortcut> : null}
    </UIContextMenuItem>
  );
}
