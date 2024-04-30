import { Stack } from '@/components/Toolbar.tsx';
import { TooltipButton } from '@/components/custom/button';
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuLabel,
} from '@/components/custom/dropdown-menu';
import {
  DropdownMenuContent,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
} from 'lucide-react';
import { useState } from 'react';

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

export function Pagination({
  count,
  total,
  ...props
}: {
  current: number;
  count: number;
  total: number;
  pageSize: number;
  onChange: (page: number, pageSize: number) => void;
}) {
  const [page, setPage] = useState<number>(props.current);
  const [pageSize, setPageSize] = useState<number>(props.pageSize);
  const last = Math.ceil(total / pageSize);

  const start = pageSize * (page - 1) + 1;
  const end = start + count - 1;
  const content = count >= total ? `${count} rows` : `${start}-${end}`;

  return (
    <Stack className="gap-0">
      <TooltipButton
        onClick={() => {
          setPage(1);
          props?.onChange(1, pageSize);
        }}
        disabled={page <= 1}
        icon={<ChevronsLeftIcon />}
      />

      <TooltipButton
        onClick={() => {
          setPage((prev) => {
            props?.onChange(prev - 1, pageSize);
            return prev - 1;
          });
        }}
        disabled={page <= 1}
        icon={<ChevronLeftIcon />}
      />
      <PaginationDropdown
        content={content}
        setPerPage={(pageSize) => {
          setPageSize(pageSize);
          props?.onChange(page, pageSize);
        }}
      />
      <span className="mr-1 text-sm">
        {count < total ? `of ${total}` : null}
      </span>
      <TooltipButton
        color="inherit"
        onClick={() => {
          setPage((prev) => {
            props?.onChange(prev + 1, pageSize);
            return prev + 1;
          });
        }}
        disabled={page >= last}
        icon={<ChevronRightIcon size={16} />}
      />
      <TooltipButton
        color="inherit"
        onClick={() => {
          setPage(last);
          props?.onChange(last, pageSize);
        }}
        disabled={page >= last}
        icon={<ChevronsRightIcon />}
      />
    </Stack>
  );
}
