import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  PaginationContent,
  PaginationItem,
  PaginationLink,
} from '@/components/ui/pagination';
import { usePageStore } from '@/stores/dataset';

export interface DropdownProps {
  content: string;
}

export function PaginationDropdown({ content }: DropdownProps) {
  const { setPerPage } = usePageStore();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <PaginationContent>
          <PaginationItem>
            <PaginationLink href="#" className="w-full">
              {content}
              <KeyboardArrowDownIcon />
            </PaginationLink>
          </PaginationItem>
        </PaginationContent>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-32">
        {[10, 100, 500, 1000].map((item) => (
          <DropdownMenuItem
            key={item}
            className="py-1 text-xs"
            onSelect={() => {
              setPerPage!(item);
            }}
          >
            {item}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="py-1 text-xs">
          Default: 500
        </DropdownMenuLabel>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
