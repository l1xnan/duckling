import { TooltipButton } from '@/components/custom/button';
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuLabel,
} from '@/components/custom/dropdown-menu';

import { Stack, ToolbarBox, ToolbarContainer } from '@/components/Toolbar';

import {
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useDBListStore } from '@/stores/dbList';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import { TooltipContentProps } from '@radix-ui/react-tooltip';
import { IconInfinity, IconInfinityOff } from '@tabler/icons-react';

const tooltipProps = {
  side: 'bottom',
  align: 'start',
  sideOffset: 5,
  alignOffset: 5,
  className: 'font-mono text-xs',
} as TooltipContentProps;

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
          <TooltipButton
            className="text-green-900"
            tooltip="Run (Ctrl+Enter)"
            onClick={() => onClick()}
          >
            <PlayArrowIcon fontSize="inherit" />
          </TooltipButton>
          <TooltipButton
            className="text-green-900"
            tooltip="Run in the new TAB"
            onClick={() => onClick('new')}
          >
            <PlaylistAddIcon fontSize="inherit" />
          </TooltipButton>

          <TooltipButton
            onClick={() => {
              onHasLimit(!hasLimit);
            }}
            tooltip={hasLimit ? 'limit 500' : 'not limit'}
            tooltipProps={tooltipProps}
          >
            {hasLimit ? <IconInfinityOff /> : <IconInfinity />}
          </TooltipButton>
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
    <DropdownMenu content={content ?? `unknown`}>
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
