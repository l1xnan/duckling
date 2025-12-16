import {
  IconDatabaseCog,
  IconFolderPlus,
  IconRefresh,
} from '@tabler/icons-react';
import * as dialog from '@tauri-apps/plugin-dialog';
import { useAtomValue } from 'jotai';

import { getDB } from '@/api';
import { Stack, ToolbarContainer } from '@/components/Toolbar';
import { TooltipButton } from '@/components/custom/button';
import { useDialog } from '@/components/custom/use-dialog';
import { ConfigDialog } from '@/pages/sidebar/dialog/ConfigDialog';
import { DatabaseDialog } from '@/pages/sidebar/dialog/DatabaseDialog';
import {
  DialectType,
  selectedNodeAtom,
  useDBListStore,
  useDbMapStore,
} from '@/stores/dbList';
import { ChevronsDownUpIcon, ChevronsUpDownIcon } from 'lucide-react';
import { useShallow } from 'zustand/shallow';

export function SideToolbar({
  onExpandAll,
  onCollapseAll,
}: {
  onExpandAll: () => void;
  onCollapseAll: () => void;
}) {
  const [dbList, appendDB, updateDB, _removeDB] = useDBListStore(
    useShallow((s) => [s.dbList, s.append, s.updateByConfig, s.remove]),
  );
  const dbMap = useDbMapStore();
  async function handleGetDB(path: string, dialect: DialectType) {
    const data = await getDB({ path, dialect });
    appendDB(data);
  }

  const selectedNode = useAtomValue(selectedNodeAtom);
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

      for (const db of dbList) {
        if (db.id == root) {
          updateDB(
            root,
            db.config ?? { path: db.data.path, dialect: 'folder' },
          );
        }
      }
    }
  }

  // TODO: Remove the root element restriction
  // const isRoot = selectedNode?.type == 'root';
  const d = useDialog();
  return (
    <>
      <div className="h-8 min-h-8 w-full px-2 flex items-center justify-between border-b">
        <div className="font-semibold text-sm">Database Explorer</div>
        <div className="flex items-center">
          <TooltipButton tooltip="Expand All" onClick={onExpandAll}>
            <ChevronsUpDownIcon />
          </TooltipButton>
          <TooltipButton tooltip="Collapse All" onClick={onCollapseAll}>
            <ChevronsDownUpIcon />
          </TooltipButton>
        </div>
      </div>
      <ToolbarContainer>
        <Stack>
          <TooltipButton tooltip="Add data folder" onClick={handleAppendFolder}>
            <IconFolderPlus />
          </TooltipButton>
          <DatabaseDialog />
          <TooltipButton
            tooltip="DB setting"
            disabled={!selectedNode}
            onClick={d.trigger}
          >
            <IconDatabaseCog />
          </TooltipButton>
          {/* refresh tree */}
          <TooltipButton
            tooltip="Refresh DB"
            disabled={!selectedNode}
            onClick={handleRefresh}
          >
            <IconRefresh />
          </TooltipButton>
        </Stack>
        <ConfigDialog key={db?.id} {...d.props} ctx={db} />
      </ToolbarContainer>
    </>
  );
}
