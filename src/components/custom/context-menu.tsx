import { LucideIcon } from 'lucide-react';

import {
  ContextMenuShortcut,
  ContextMenuItem as UIContextMenuItem,
} from '@/components/custom/ui/context-menu';

import type { ComponentProps, ReactNode } from 'react';

interface ContextMenuItemProps
  extends Omit<ComponentProps<typeof UIContextMenuItem>, 'onClick'> {
  icon?: LucideIcon;
  shortcut?: string;
  onSelect?: ComponentProps<typeof UIContextMenuItem>['onClick'];
  children: ReactNode | string;
}

export function ContextMenuItem({
  shortcut,
  icon: IconComponent,
  onSelect,
  ...props
}: ContextMenuItemProps) {
  return (
    <UIContextMenuItem
      onClick={onSelect}
      {...props}
      inset={!IconComponent ? true : undefined}
    >
      {IconComponent ? <IconComponent size={14} /> : null}
      {props.children}
      {shortcut ? <ContextMenuShortcut>{shortcut}</ContextMenuShortcut> : null}
    </UIContextMenuItem>
  );
}
