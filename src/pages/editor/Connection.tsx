import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import Button from '@mui/material/Button';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useDBListStore } from '@/stores/dbList';

export interface DropdownProps {
  content: string;
}

export default function Connection({ content }: DropdownProps) {
  const dbList = useDBListStore((s) => s.dbList);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="text"
          disableElevation
          sx={{ textTransform: 'none' }}
          endIcon={<KeyboardArrowDownIcon />}
        >
          {content ?? `current session`}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-full">
        <DropdownMenuLabel>Session</DropdownMenuLabel>
        {dbList.map((item) => (
          <DropdownMenuItem
            key={item.id}
            onClick={() => {
              // TODO: update tab context
            }}
          >
            {item.displayName}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
