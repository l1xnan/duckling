import { TooltipButton } from '@/components/custom/button';
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuLabel,
} from '@/components/custom/dropdown-menu';

import { Stack, ToolbarBox, ToolbarContainer } from '@/components/Toolbar';

import { ListPlusIcon, PlayIcon } from 'lucide-react';

import {
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { DBType, useDBListStore } from '@/stores/dbList';
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
  setSession,
}: {
  onClick: (action?: string) => void;
  onHasLimit: (limit: boolean) => void;
  session?: string;
  hasLimit?: boolean;
  setSession: (s: DBType) => void;
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
            <PlayIcon fontSize="inherit" />
          </TooltipButton>
          <TooltipButton
            className="text-green-900"
            tooltip="Run in the new TAB"
            onClick={() => onClick('new')}
          >
            <ListPlusIcon fontSize="inherit" />
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
          <Connection content={session} setSession={setSession} />
        </Stack>
      </ToolbarBox>
    </ToolbarContainer>
  );
}

export interface DropdownProps {
  content?: string;
  setSession: (s: DBType) => void;
}

export default function Connection({ content, setSession }: DropdownProps) {
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
                setSession(item);
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
