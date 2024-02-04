import {
  DropdownMenu,
  DropdownMenuItem,
} from '@/components/custom/dropdown-menu';
import {
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

export interface DropdownProps {
  content: string;
  setPerPage: (page: number) => void;
}

export function PaginationDropdown({ content, setPerPage }: DropdownProps) {
  return (
    <DropdownMenu content={content}>
      <DropdownMenuContent className="w-32">
        {[10, 100, 500, 1000].map((item) => (
          <DropdownMenuItem
            key={item}
            onSelect={() => {
              setPerPage(item);
            }}
          >
            {item}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Default: 500</DropdownMenuLabel>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
