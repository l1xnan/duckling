import { Trans, useLingui } from '@lingui/react/macro';
import { TooltipButton } from '@/components/custom/button';
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuLabel,
} from '@/components/custom/dropdown-menu';

import { Stack, ToolbarBox, ToolbarContainer } from '@/components/Toolbar';

import {
  AlignLeftIcon,
  ListPlusIcon,
  PlayIcon,
  TextSelectIcon,
} from 'lucide-react';

import {
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { TooltipContent } from '@/components/ui/tooltip';
import { DBType, useDBListStore } from '@/stores/dbList';
import { IconInfinity, IconInfinityOff } from '@tabler/icons-react';
import React from 'react';

const tooltipProps = {
  side: 'bottom',
  align: 'start',
  sideOffset: 5,
  alignOffset: 5,
  className: 'font-mono text-xs',
} as React.ComponentProps<typeof TooltipContent>;

export function EditorToolbar({
  onClick,
  session,
  onHasLimit,
  hasLimit,
  setSession,
  onFormat,
  canFormatSelection = false,
}: {
  onClick: (action?: string) => void;
  onHasLimit: (limit: boolean) => void;
  session?: string;
  hasLimit?: boolean;
  setSession: (s: DBType) => void;
  onFormat?: (scope: 'document' | 'selection') => void;
  canFormatSelection?: boolean;
}) {
  const { t } = useLingui();

  return (
    <ToolbarContainer>
      <ToolbarBox>
        <Stack>
          <TooltipButton
            className="text-green-900"
            tooltip={t`Run (Ctrl+Enter)`}
            onClick={() => onClick()}
          >
            <PlayIcon fontSize="inherit" />
          </TooltipButton>
          <TooltipButton
            className="text-green-900"
            tooltip={t`Run in the new TAB`}
            onClick={() => onClick('new')}
          >
            <ListPlusIcon fontSize="inherit" />
          </TooltipButton>

          <TooltipButton
            onClick={() => {
              onHasLimit(!hasLimit);
            }}
            tooltip={hasLimit ? t`limit 500` : t`not limit`}
            tooltipProps={tooltipProps}
          >
            {hasLimit ? <IconInfinityOff /> : <IconInfinity />}
          </TooltipButton>

          <TooltipButton
            tooltip={t`Format Document (Shift+Alt+F)`}
            tooltipProps={tooltipProps}
            onClick={() => onFormat?.('document')}
          >
            <AlignLeftIcon fontSize="inherit" />
          </TooltipButton>
          <TooltipButton
            tooltip={t`Format Selection`}
            tooltipProps={tooltipProps}
            disabled={!canFormatSelection}
            onClick={() => onFormat?.('selection')}
          >
            <TextSelectIcon fontSize="inherit" />
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
  const { t } = useLingui();
  const dbList = useDBListStore((s) => s.dbList);

  return (
    <DropdownMenu content={content ?? t`unknown`}>
      <DropdownMenuContent className="w-full">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <Trans>Session</Trans>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {dbList.map((item) => (
            <DropdownMenuItem
              key={item.id}
              onSelect={() => {
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
