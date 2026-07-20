import { useLingui } from '@lingui/react/macro';
import { Stack } from '@/components/Toolbar';
import { TooltipButton } from '@/components/custom/tooltip';
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuLabel,
} from '@/components/custom/dropdown-menu';
import {
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuSeparator,
} from '@/components/custom/ui/dropdown-menu';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';

export interface DropdownProps {
  content: string;
  setPerPage: (page: number) => void;
}

export function PaginationDropdown({ content, setPerPage }: DropdownProps) {
  const { t } = useLingui();
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
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t`Default: 500`}</DropdownMenuLabel>
        </DropdownMenuGroup>
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
  const { t } = useLingui();
  const [page, setPage] = useState<number>(props.current);
  const [pageSize, setPageSize] = useState<number>(props.pageSize);

  useEffect(() => {
    setPage(props.current);
  }, [props.current]);

  useEffect(() => {
    setPageSize(props.pageSize);
  }, [props.pageSize]);

  const last = Math.ceil(total / pageSize);

  const start = pageSize * (page - 1) + 1;
  const end = start + count - 1;
  const content = count >= total ? t`${count} rows` : `${start}-${end}`;

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
      <span className="mr-1 text-xs">
        {count < total ? t`of ${total}` : null}
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
