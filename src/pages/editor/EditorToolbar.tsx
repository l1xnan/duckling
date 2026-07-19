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
  BookmarkPlusIcon,
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
import { formatHotkey, getHotkey } from '@/hotkeys';
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
  onBookmark,
  onExplain,
}: {
  onClick: (action?: string) => void;
  onHasLimit: (limit: boolean) => void;
  session?: string;
  hasLimit?: boolean;
  setSession: (s: DBType) => void;
  onFormat?: (scope: 'document' | 'selection') => void;
  canFormatSelection?: boolean;
  onBookmark?: () => void;
  onExplain?: (analyze?: boolean) => void;
}) {
  const { t } = useLingui();

  return (
    <ToolbarContainer>
      <ToolbarBox>
        <Stack>
          <TooltipButton
            className="text-green-900"
            tooltip={t`Run (${formatHotkey(getHotkey('editor.run'))})`}
            onClick={() => onClick()}
          >
            <PlayIcon fontSize="inherit" />
          </TooltipButton>
          <TooltipButton
            className="text-green-900"
            tooltip={t`Run in new tab (${formatHotkey(getHotkey('editor.runNewTab'))})`}
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
            tooltip={t`Format document (${formatHotkey(getHotkey('editor.format'))})`}
            tooltipProps={tooltipProps}
            onClick={() => onFormat?.('document')}
          >
            <AlignLeftIcon fontSize="inherit" />
          </TooltipButton>
          <TooltipButton
            tooltip={t`Format selection (${formatHotkey(getHotkey('editor.formatSelection'))})`}
            tooltipProps={tooltipProps}
            disabled={!canFormatSelection}
            onClick={() => onFormat?.('selection')}
          >
            <TextSelectIcon fontSize="inherit" />
          </TooltipButton>
          {onExplain ? (
            <TooltipButton
              tooltip={t`EXPLAIN`}
              tooltipProps={tooltipProps}
              onClick={() => onExplain(false)}
            >
              <span className="text-[10px] font-mono font-semibold px-0.5">EX</span>
            </TooltipButton>
          ) : null}
          {onBookmark ? (
            <TooltipButton
              tooltip={t`Bookmark SQL`}
              tooltipProps={tooltipProps}
              onClick={onBookmark}
            >
              <BookmarkPlusIcon fontSize="inherit" />
            </TooltipButton>
          ) : null}
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
