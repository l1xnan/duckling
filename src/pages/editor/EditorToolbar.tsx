import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import { IconButton } from '@mui/material';

import { Stack, ToolbarBox, ToolbarContainer } from '@/components/Toolbar';
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuLabel,
} from '@/components/custom/dropdown-menu';
import {
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useDBListStore } from '@/stores/dbList';
import { FlaskConical, FlaskConicalOffIcon } from 'lucide-react';

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
          <IconButton
            color="inherit"
            onClick={() => {
              onHasLimit(!hasLimit);
            }}
          >
            {hasLimit ? (
              <FlaskConical className="h-3.5 w-3.5" />
            ) : (
              <FlaskConicalOffIcon className="h-3.5 w-3.5" />
            )}
          </IconButton>
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
