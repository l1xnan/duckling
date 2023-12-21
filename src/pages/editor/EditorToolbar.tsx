import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import { IconButton, Stack } from '@mui/material';

import { ToolbarBox, ToolbarContainer } from '@/components/Toolbar';

import Connection from './Connection';

export function EditorToolbar({
  onClick,
}: {
  onClick: (action?: string) => void;
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
          <Connection />
        </Stack>
      </ToolbarBox>
    </ToolbarContainer>
  );
}
