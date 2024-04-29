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
import { DatabaseDialog } from '@/pages/sidebar/DatabaseDialog';
import {
  DialectType,
  configAtom,
  dbMapAtom,
  selectedNodeAtom,
  useDBListStore,
} from '@/stores/dbList';
import { ChevronsDownUpIcon, ChevronsUpDownIcon } from 'lucide-react';

export function SideToolbar({
  onExpandAll,
  onCollapseAll,
}: {
  onExpandAll: () => void;
  onCollapseAll: () => void;
}) {
  const dbList = useDBListStore((state) => state.dbList);
  const appendDB = useDBListStore((state) => state.append);
  const removeDB = useDBListStore((state) => state.remove);
  const updateDB = useDBListStore((state) => state.update);

  const setConfigContext = useSetAtom(configAtom);

  async function handleGetDB(path: string, dialect: DialectType) {
    const data = await getDB({ path, dialect });
    appendDB(data);
  }

  const selectedNode = useAtomValue(selectedNodeAtom);
  const dbMap = useAtomValue(dbMapAtom);

  const handleOpen = () => {
    if (selectedNode) {
      const db = dbMap.get(selectedNode.dbId);
      if (db) {
        setConfigContext(db);
      }
    }
  };

  // async function handleRemoveDB() {
  //   if (selectedNode) {
  //     removeDB(selectedNode.dbId);
  //   }
  // }

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

  const isRoot = selectedNode?.type == 'root';

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
            onClick={handleOpen}
          >
            <IconDatabaseCog />
          </TooltipButton>
          {/* remove db */}
          {/* <TooltipButton
            tooltip="Remove DB"
            disabled={!isRoot}
            onClick={handleRemoveDB}
          >
            <RemoveIcon />
          </TooltipButton> */}
          {/* refresh tree */}
          <TooltipButton
            tooltip="Refresh DB"
            disabled={!isRoot}
            onClick={handleRefresh}
          >
            <IconRefresh />
          </TooltipButton>
        </Stack>
      </ToolbarContainer>
    </>
  );
}
