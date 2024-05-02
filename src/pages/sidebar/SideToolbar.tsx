import {
  IconDatabaseCog,
  IconFolderPlus,
  IconRefresh,
} from '@tabler/icons-react';
import * as dialog from '@tauri-apps/plugin-dialog';
import { useAtomValue, useSetAtom } from 'jotai';

import { getDB } from '@/api';
import { Stack, ToolbarContainer } from '@/components/Toolbar';
import { TooltipButton } from '@/components/custom/button';
import { DatabaseDialog } from '@/pages/sidebar/dialog/DatabaseDialog';
import {
  DialectType,
  configAtom,
  dbMapAtom,
  selectedNodeAtom,
  useDBListStore,
} from '@/stores/dbList';
import { ChevronsDownUpIcon, ChevronsUpDownIcon } from 'lucide-react';
import { useDialog } from '@/components/custom/use-dialog';
import ConfigDialog from './dialog/ConfigDialog';

export function SideToolbar({
  onExpandAll,
  onCollapseAll,
}: {
  onExpandAll: () => void;
  onCollapseAll: () => void;
}) {
  const [dbList, appendDB, updateDB, removeDB] = useDBListStore((s) => [
    s.dbList,
    s.append,
    s.update,
    s.remove,
  ]);

  const setConfigContext = useSetAtom(configAtom);

  async function handleGetDB(path: string, dialect: DialectType) {
    const data = await getDB({ path, dialect });
    appendDB(data);
  }

  const selectedNode = useAtomValue(selectedNodeAtom);
  const dbMap = useAtomValue(dbMapAtom);
  const db = dbMap.get(selectedNode?.dbId);

  console.log(db, selectedNode)

  const handleOpen = () => {
    if (selectedNode) {
      const db = dbMap.get(selectedNode.dbId);
      if (db) {
        setConfigContext(db);
      }
    }
  };

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

      dbList.forEach(async (db) => {
        if (db.id == root) {
          const { data } = await getDB(
            db.config ?? { path: db.data.path, dialect: 'folder' },
          );
          updateDB(root, data);
        }
      });
    }
  }

  // TODO: Remove the root element restriction
  const isRoot = selectedNode?.type == 'root';
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
            disabled={!isRoot}
            onClick={d.trigger}
          >
            <IconDatabaseCog />
          </TooltipButton>
          {/* refresh tree */}
          <TooltipButton
            tooltip="Refresh DB"
            disabled={!isRoot}
            onClick={handleRefresh}
          >
            <IconRefresh />
          </TooltipButton>
        </Stack>
        <ConfigDialog key={db?.id} {...d.props} ctx={db}/> 
      </ToolbarContainer>
    </>
  );
}
