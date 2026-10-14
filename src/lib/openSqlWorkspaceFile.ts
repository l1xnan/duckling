import { toast } from 'sonner';

import { readTextFile } from '@/api';
import type { EditorContextType, TabContextType } from '@/stores/tabs';
import type { TreeNode } from '@/types';

export type OpenSqlWorkspaceFileDeps = {
  tabs: Record<string, TabContextType>;
  updateTab: (tab: TabContextType) => void;
  setDocs: (
    updater: (prev: Record<string, string>) => Record<string, string>,
  ) => void;
  resolveDbId: () => string;
};

export async function openSqlWorkspaceFile(
  node: Pick<TreeNode, 'path' | 'name'>,
  deps: OpenSqlWorkspaceFileDeps,
): Promise<void> {
  const path = node.path.replace(/\\/g, '/');
  const existing = deps.tabs[path];
  if (existing) {
    deps.updateTab(existing);
    return;
  }

  try {
    const content = await readTextFile(path);
    deps.setDocs((prev) => ({ ...prev, [path]: content }));
    deps.updateTab({
      id: path,
      dbId: deps.resolveDbId(),
      displayName: node.name,
      type: 'editor',
      path,
    } satisfies EditorContextType);
  } catch (e) {
    toast.error(String(e));
  }
}
