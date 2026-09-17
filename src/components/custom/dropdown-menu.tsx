import { ComponentProps, PropsWithChildren, ReactNode } from 'react';

import {
  DropdownMenuTrigger,
  DropdownMenu as UIDropdownMenu,
  DropdownMenuItem as UIDropdownMenuItem,
  DropdownMenuLabel as UIDropdownMenuLabel,
} from '@/components/custom/ui/dropdown-menu';
import {
  PaginationContent,
  PaginationItem,
  PaginationLink,
} from '@/components/ui/pagination';
import { ChevronDownIcon } from 'lucide-react';

export interface DropdownProps extends PropsWithChildren<
  ComponentProps<typeof UIDropdownMenu>
> {
  content: ReactNode;
}

export function DropdownMenu({ content, children }: DropdownProps) {
  return (
    <UIDropdownMenu>
      <DropdownMenuTrigger>
        <PaginationContent>
          <PaginationItem>
            <PaginationLink
              className="w-full max-w-48 gap-1 px-2 text-xs"
              size={'sm'}
            >
              {content}
              <ChevronDownIcon className="size-4 shrink-0" />
            </PaginationLink>
          </PaginationItem>
        </PaginationContent>
      </DropdownMenuTrigger>
      {children}
    </UIDropdownMenu>
  );
}

export function DropdownMenuItem({
  onSelect,
  ...props
}: ComponentProps<typeof UIDropdownMenuItem> & {
  onSelect?: ComponentProps<typeof UIDropdownMenuItem>['onClick'];
}) {
  return <UIDropdownMenuItem onClick={onSelect} {...props} />;
}
export function DropdownMenuLabel(
  props: ComponentProps<typeof UIDropdownMenuLabel>,
) {
  return <UIDropdownMenuLabel {...props} />;
}
