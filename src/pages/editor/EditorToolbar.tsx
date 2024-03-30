import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuLabel,
} from '@/components/custom/dropdown-menu';

import { Stack, ToolbarBox, ToolbarContainer } from '@/components/Toolbar';

import { Button } from '@/components/ui/button';
import {
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useDBListStore } from '@/stores/dbList';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import { IconButton } from '@mui/material';
import {
  IconInfinity,
  IconInfinityOff,
  Icon as TablerIcon,
} from '@tabler/icons-react';
import { atom } from 'jotai';
import { LucideIcon } from 'lucide-react';

export const activeSideAtom = atom('database');

interface TooltipButtonProps {
  active?: boolean;
  icon: LucideIcon | TablerIcon;
  onClick?: () => void;
}

const LimitButton = ({ active, icon: Comp, onClick }: TooltipButtonProps) => {
  const label = !active ? 'limit 500' : 'query all';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 rounded-lg"
            aria-label={label}
            onClick={onClick}
          >
            <Comp className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent
          side="right"
          sideOffset={5}
          alignOffset={5}
          className="font-mono text-xs"
        >
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export function EditorToolbar({
  onClick,
  session,
  onHasLimit,
  hasLimit,
}: {
  onClick: (action?: string) => void;
  onHasLimit: (limit: boolean) => void;
  session?: string;
  hasLimit?: boolean;
}) {
  return (
    <ToolbarContainer>
      <ToolbarBox>
        <Stack>
          <IconButton
            size="small"
            sx={{
              color: 'green',
            }}
            onClick={() => onClick()}
          >
            <PlayArrowIcon fontSize="inherit" />
          </IconButton>
          <IconButton
            size="small"
            sx={{
              color: 'green',
            }}
            onClick={() => onClick('new')}
          >
            <PlaylistAddIcon fontSize="inherit" />
          </IconButton>

          <LimitButton
            icon={(hasLimit ? IconInfinityOff : IconInfinity) as TablerIcon}
            active={!hasLimit}
            onClick={() => {
              onHasLimit(!hasLimit);
            }}
          />
        </Stack>
        <Stack>
          <Connection content={session} />
        </Stack>
      </ToolbarBox>
    </ToolbarContainer>
  );
}

export interface DropdownProps {
  content?: string;
}

export default function Connection({ content }: DropdownProps) {
  const dbList = useDBListStore((s) => s.dbList);

  return (
    <DropdownMenu content={content ?? `unknowm`}>
      <DropdownMenuContent className="w-full">
        <DropdownMenuLabel>Session</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
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
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
