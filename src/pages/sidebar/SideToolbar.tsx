import { useLingui } from '@lingui/react/macro';
import {
  IconDatabaseCog,
  IconFileExport,
  IconFileImport,
  IconFolderPlus,
  IconRefresh,
} from '@tabler/icons-react';
import * as dialog from '@tauri-apps/plugin-dialog';
import {
  ChevronsDownUpIcon,
  ChevronsUpDownIcon,
  MoreHorizontalIcon,
} from 'lucide-react';
import { useState } from 'react';
import { useShallow } from 'zustand/shallow';

import { getDB } from '@/api';
import { Stack, ToolbarContainer } from '@/components/Toolbar';
import { TooltipButton } from '@/components/custom/button';
import { useDialog } from '@/components/custom/use-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfigDialog } from '@/pages/sidebar/dialog/ConfigDialog';
import { ConnectionTransferDialog } from '@/pages/sidebar/dialog/ConnectionTransferDialog';
import { DatabaseDialog } from '@/pages/sidebar/dialog/DatabaseDialog';
import {
  DialectType,
  useDBListStore,
  useDbMapStore,
  useSelectedNodeStore,
} from '@/stores/dbList';

export function SideToolbar({
  onExpandAll,
  onCollapseAll,
}: {
  onExpandAll: () => void;
  onCollapseAll: () => void;
}) {
  const { t } = useLingui();
  const [dbList, appendDB, updateDB] = useDBListStore(
    useShallow((s) => [s.dbList, s.append, s.updateByConfig]),
  );
  const dbMap = useDbMapStore();
  const [transferMode, setTransferMode] = useState<'export' | 'import' | null>(
    null,
  );

  async function handleGetDB(path: string, dialect: DialectType) {
    const data = await getDB({ path, dialect });
    await appendDB(data);
  }

  const selectedNode = useSelectedNodeStore((s) => s.selectedNode);
  const db = selectedNode ? dbMap?.get(selectedNode?.dbId) : undefined;

  async function handleAppendFolder() {
    const res = await dialog.open({
      directory: true,
    });
    if (res) {
      handleGetDB(res, 'folder');
    }
  }

  async function handleRefresh() {
    if (selectedNode) {
      const root = selectedNode.dbId;
      // Fresh read from store — toolbar closure can hold a stale dbList snapshot.
      const latest = useDBListStore.getState().getDB(root);
      if (latest) {
        await updateDB(
          root,
          latest.config ?? {
            path: latest.data?.path ?? '',
            dialect: 'folder',
          },
        );
      }
    }
  }

  const d = useDialog();
  return (
    <>
      <div className="h-8 min-h-8 w-full px-2 flex items-center justify-between border-b">
        <div className="font-semibold text-sm">{t`Database Explorer`}</div>
        <div className="flex items-center">
          <TooltipButton tooltip={t`Expand All`} onClick={onExpandAll}>
            <ChevronsUpDownIcon />
          </TooltipButton>
          <TooltipButton tooltip={t`Collapse All`} onClick={onCollapseAll}>
            <ChevronsDownUpIcon />
          </TooltipButton>
        </div>
      </div>
      <ToolbarContainer>
        <Stack>
          <TooltipButton
            tooltip={t`Add data folder`}
            onClick={handleAppendFolder}
          >
            <IconFolderPlus />
          </TooltipButton>
          <DatabaseDialog />
          <TooltipButton
            tooltip={t`DB setting`}
            disabled={!selectedNode}
            onClick={d.trigger}
          >
            <IconDatabaseCog />
          </TooltipButton>
          <TooltipButton
            tooltip={t`Refresh DB`}
            disabled={!selectedNode}
            onClick={handleRefresh}
          >
            <IconRefresh />
          </TooltipButton>
          <DropdownMenu>
            <DropdownMenuTrigger
              className="inline-flex size-6 items-center justify-center rounded-lg hover:bg-muted aria-expanded:bg-muted"
              aria-label={t`More actions`}
            >
              <MoreHorizontalIcon className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-40">
              <DropdownMenuItem onClick={() => setTransferMode('import')}>
                <IconFileImport />
                {t`Import connections`}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={dbList.length === 0}
                onClick={() => setTransferMode('export')}
              >
                <IconFileExport />
                {t`Export connections`}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </Stack>
        <ConfigDialog key={db?.id} {...d.props} ctx={db} />
        <ConnectionTransferDialog
          mode={transferMode ?? 'export'}
          open={transferMode != null}
          onOpenChange={(open) => {
            if (!open) {
              setTransferMode(null);
            }
          }}
        />
      </ToolbarContainer>
    </>
  );
}
