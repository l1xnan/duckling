import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { ComponentProps, PropsWithChildren } from 'react';

import {
  DropdownMenuTrigger,
  DropdownMenu as UIDropdownMenu,
} from '@/components/ui/dropdown-menu';
import {
  PaginationContent,
  PaginationItem,
  PaginationLink,
} from '@/components/ui/pagination';

export interface DropdownProps
  extends PropsWithChildren<ComponentProps<typeof UIDropdownMenu>> {
  content: string;
}

export function DropdownMenu({ content, children }: DropdownProps) {
  return (
    <UIDropdownMenu>
      <DropdownMenuTrigger asChild>
        <PaginationContent>
          <PaginationItem>
            <PaginationLink className="w-full">
              {content}
              <KeyboardArrowDownIcon />
            </PaginationLink>
          </PaginationItem>
        </PaginationContent>
      </DropdownMenuTrigger>
      {children}
    </UIDropdownMenu>
  );
}
