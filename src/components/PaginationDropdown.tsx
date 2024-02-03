import {
  DropdownMenu,
  DropdownMenuItem,
} from '@/components/custom/dropdown-menu';
import {
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { usePageStore } from '@/stores/dataset';

export interface DropdownProps {
  content: string;
}

export function PaginationDropdown({ content }: DropdownProps) {
  const { setPerPage } = usePageStore();
  return (
    <DropdownMenu content={content}>
      <DropdownMenuContent className="w-32">
        {[10, 100, 500, 1000].map((item) => (
          <DropdownMenuItem
            key={item}
            onSelect={() => {
              setPerPage!(item);
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
