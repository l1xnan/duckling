import type { DBType } from '@/stores/dbList';
import type { NodeElementType } from '@/types';
import { convertId } from '@/utils';

export const DB_TREE_ROOT = '__root__';

/**
 * Build the unfiltered database tree shared by the explorer view and
 * programmatic consumers (e.g. reveal-in-sidebar). Mirrors the visible
 * connection whitelist so lookups only hit rendered nodes.
 */
export function buildDatabaseTreeData(dbList: DBType[]): NodeElementType {
  return {
    id: DB_TREE_ROOT,
    children: dbList.map((db) => {
      let treeData = convertId(db.data, db.id, db.displayName);
      // Apply visibleDatabases filter if set
      if (db.visibleDatabases && db.visibleDatabases.length > 0) {
        treeData = {
          ...treeData,
          children: treeData.children?.filter((child) =>
            db.visibleDatabases!.includes(child.name),
          ),
        };
      }
      return {
        ...treeData,
        loading: db.loading,
        icon: db.dialect,
      };
    }),
  } as NodeElementType;
}
