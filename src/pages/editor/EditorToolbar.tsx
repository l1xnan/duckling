import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import { IconButton, Stack } from '@mui/material';

import { ToolbarBox, ToolbarContainer } from '@/components/Toolbar';
import { DropdownMenu } from '@/components/custom/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useDBListStore } from '@/stores/dbList';

export function EditorToolbar({
  onClick,
  session,
}: {
  onClick: (action?: string) => void;
  session: string;
}) {
  return (
    <ToolbarContainer>
      <ToolbarBox>
        <Stack direction="row">
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
        </Stack>
        <Stack direction="row">
          <Connection content={session} />
        </Stack>
      </ToolbarBox>
    </ToolbarContainer>
  );
}

export interface DropdownProps {
  content: string;
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
