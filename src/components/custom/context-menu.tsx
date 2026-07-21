import { LucideIcon } from 'lucide-react';

import {
  ContextMenuShortcut,
  ContextMenuItem as UIContextMenuItem,
} from '@/components/custom/ui/context-menu';

import type { ReactNode } from 'react';

interface ContextMenuItemProps {
  icon?: LucideIcon;
  shortcut?: string;
  onSelect?: (event: any) => void;
  onClick?: (event: any) => void;
  children: ReactNode | string;
  inset?: boolean;
  className?: string;
  disabled?: boolean;
  tabIndex?: number;
}

export function ContextMenuItem({
  shortcut,
  icon: IconComponent,
  onSelect,
  onClick,
  ...props
}: ContextMenuItemProps) {
  return (
    <UIContextMenuItem
      onClick={onSelect ?? onClick}
      {...props}
      inset={!IconComponent ? true : undefined}
    >
      {IconComponent ? <IconComponent size={14} /> : null}
      {props.children}
      {shortcut ? <ContextMenuShortcut>{shortcut}</ContextMenuShortcut> : null}
    </UIContextMenuItem>
  );
}
