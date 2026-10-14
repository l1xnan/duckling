import type { SqlBookmark } from '@/stores/workspaceStore';
import type { DBType } from '@/stores/dbList';
import type { EditorContextType, SchemaContextType, TabContextType } from '@/stores/tabs';
import { buildDatabaseTreeData } from '@/lib/dbTreeData';
import {
  isBrowsablePathNode,
  isSyntheticSchemaPath,
} from '@/lib/treeNode';
import type { NodeElementType, TreeNode } from '@/types';

export type OpenAnythingKind =
  | 'table'
  | 'view'
  | 'file'
  | 'database'
  | 'connection'
  | 'favorite'
  | 'bookmark'
  | 'scratch'
  | 'sqlFile';

export type OpenAnythingPayload =
  | {
      kind: 'connection';
      dbId: string;
      rootPath: string;
      displayName: string;
    }
  | {
      kind: 'database';
      dbId: string;
      schemaPath: string;
      displayName: string;
    }
  | {
      kind: 'schemaFiles';
      dbId: string;
      schemaPath: string;
      displayName: string;
    }
  | {
      kind: 'table';
      dbId: string;
      nodeId: string;
      path: string;
      displayName: string;
    }
  | { kind: 'favorite'; tab: TabContextType }
  | { kind: 'bookmark'; bookmark: SqlBookmark }
  | { kind: 'scratch'; tab: EditorContextType }
  | { kind: 'sqlFile'; path: string; name: string; dbId: string };

export type OpenAnythingItem = {
  id: string;
  kind: OpenAnythingKind;
  name: string;
  subtitle: string;
  searchPath: string;
  connectionName: string;
  payload: OpenAnythingPayload;
};

const SKIP_TYPES = new Set(['root']);

const GROUP_ORDER: OpenAnythingKind[] = [
  'table',
  'view',
  'file',
  'database',
  'connection',
  'favorite',
  'bookmark',
  'scratch',
  'sqlFile',
];

const EMPTY_GROUP_LIMIT = 5;
export const OPEN_ANYTHING_MAX_RESULTS = 80;

const SCORE_EXACT = 1000;
const SCORE_PREFIX = 800;
const SCORE_SUBSTRING_NAME = 600;
const SCORE_SUBSTRING_META = 400;
const SCORE_SUBSEQUENCE = 200;

function classifyLeaf(
  node: NodeElementType,
): 'table' | 'view' | 'file' | null {
  const type = node.type;
  if (SKIP_TYPES.has(type) || type === 'database' || type === 'path') {
    return null;
  }
  if (type === 'table') {
    return 'table';
  }
  if (type === 'view') {
    return 'view';
  }
  return 'file';
}

function walkDbTree(
  node: NodeElementType,
  db: DBType,
  connectionLabel: string,
  items: OpenAnythingItem[],
  isConnectionRoot: boolean,
) {
  if (isSyntheticSchemaPath(node.path)) {
    for (const child of node.children ?? []) {
      walkDbTree(child, db, connectionLabel, items, false);
    }
    return;
  }

  if (isConnectionRoot) {
    items.push({
      id: `connection:${node.dbId}`,
      kind: 'connection',
      name: connectionLabel,
      subtitle: db.dialect,
      searchPath: node.path,
      connectionName: connectionLabel,
      payload: {
        kind: 'connection',
        dbId: node.dbId,
        rootPath: node.path,
        displayName: connectionLabel,
      },
    });
    isConnectionRoot = false;
  }

  if (node.type === 'database') {
    items.push({
      id: `database:${node.dbId}:${node.path}`,
      kind: 'database',
      name: node.name,
      subtitle: connectionLabel,
      searchPath: node.path,
      connectionName: connectionLabel,
      payload: {
        kind: 'database',
        dbId: node.dbId,
        schemaPath: node.path,
        displayName: node.name,
      },
    });
  }

  if (
    node.type === 'path' &&
    isBrowsablePathNode(node, db.dialect) &&
    !isSyntheticSchemaPath(node.path)
  ) {
    items.push({
      id: `schemaFiles:${node.dbId}:${node.path}`,
      kind: 'database',
      name: node.name,
      subtitle: connectionLabel,
      searchPath: node.path,
      connectionName: connectionLabel,
      payload: {
        kind: 'schemaFiles',
        dbId: node.dbId,
        schemaPath: node.path,
        displayName: node.name,
      },
    });
  }

  const leafKind = classifyLeaf(node);
  if (leafKind) {
    items.push({
      id: `leaf:${node.id}`,
      kind: leafKind,
      name: node.name,
      subtitle: `${connectionLabel} · ${node.path}`,
      searchPath: node.path,
      connectionName: connectionLabel,
      payload: {
        kind: 'table',
        dbId: node.dbId,
        nodeId: node.id,
        path: node.path,
        displayName: node.name,
      },
    });
  }

  for (const child of node.children ?? []) {
    walkDbTree(child, db, connectionLabel, items, false);
  }
}

export function flattenSqlFileNodes(node: TreeNode): TreeNode[] {
  const out: TreeNode[] = [];
  const isDir =
    node.type === 'path' || (node.children?.length ?? 0) > 0;
  if (!isDir) {
    out.push(node);
    return out;
  }
  for (const child of node.children ?? []) {
    out.push(...flattenSqlFileNodes(child));
  }
  return out;
}

export type BuildOpenAnythingIndexInput = {
  dbList: DBType[];
  favorites: TabContextType[];
  bookmarks: SqlBookmark[];
  scratchEditors: EditorContextType[];
  sqlFileTrees: Array<{ rootPath: string; tree: TreeNode | null }>;
  defaultDbId: string;
};

export function buildOpenAnythingIndex(
  input: BuildOpenAnythingIndexInput,
): OpenAnythingItem[] {
  const items: OpenAnythingItem[] = [];
  const root = buildDatabaseTreeData(input.dbList);
  const dbMap = new Map(input.dbList.map((db) => [db.id, db]));

  for (const connNode of root.children ?? []) {
    const db = dbMap.get(connNode.dbId);
    if (!db) {
      continue;
    }
    const label = db.displayName || connNode.name;
    walkDbTree(connNode, db, label, items, true);
  }

  for (const tab of input.favorites) {
    items.push({
      id: `favorite:${tab.id}`,
      kind: 'favorite',
      name: tab.displayName,
      subtitle: tab.dbId,
      searchPath: tab.type === 'table' ? (tab as { tableId?: string }).tableId ?? '' : '',
      connectionName: '',
      payload: { kind: 'favorite', tab },
    });
  }

  for (const bookmark of input.bookmarks) {
    const summary = bookmark.stmt.replace(/\s+/g, ' ').trim().slice(0, 80);
    items.push({
      id: `bookmark:${bookmark.id}`,
      kind: 'bookmark',
      name: bookmark.title || summary,
      subtitle: summary,
      searchPath: bookmark.stmt,
      connectionName: bookmark.dbId,
      payload: { kind: 'bookmark', bookmark },
    });
  }

  for (const tab of input.scratchEditors) {
    items.push({
      id: `scratch:${tab.id}`,
      kind: 'scratch',
      name: tab.displayName,
      subtitle: tab.dbId,
      searchPath: tab.path ?? tab.id,
      connectionName: '',
      payload: { kind: 'scratch', tab },
    });
  }

  for (const { rootPath, tree } of input.sqlFileTrees) {
    if (!tree) {
      continue;
    }
    for (const file of flattenSqlFileNodes(tree)) {
      const path = file.path.replace(/\\/g, '/');
      items.push({
        id: `sqlFile:${path}`,
        kind: 'sqlFile',
        name: file.name,
        subtitle: rootPath,
        searchPath: path,
        connectionName: '',
        payload: {
          kind: 'sqlFile',
          path,
          name: file.name,
          dbId: input.defaultDbId,
        },
      });
    }
  }

  return items;
}

export function isAsciiSubsequence(needle: string, haystack: string): boolean {
  if (!needle) {
    return true;
  }
  let i = 0;
  for (const ch of haystack) {
    if (ch === needle[i]) {
      i += 1;
    }
    if (i === needle.length) {
      return true;
    }
  }
  return i === needle.length;
}

export function scoreOpenAnythingItem(
  query: string,
  item: OpenAnythingItem,
): number | null {
  const q = query.trim().toLowerCase();
  if (!q) {
    return 1;
  }
  const name = item.name.toLowerCase();
  const path = item.searchPath.toLowerCase();
  const conn = item.connectionName.toLowerCase();
  const subtitle = item.subtitle.toLowerCase();

  if (name === q) {
    return SCORE_EXACT;
  }
  if (name.startsWith(q)) {
    return SCORE_PREFIX;
  }
  if (name.includes(q)) {
    return SCORE_SUBSTRING_NAME;
  }
  if (path.includes(q) || conn.includes(q) || subtitle.includes(q)) {
    return SCORE_SUBSTRING_META;
  }
  if (isAsciiSubsequence(q, name)) {
    return SCORE_SUBSEQUENCE;
  }
  return null;
}

export function rankOpenAnything(
  items: OpenAnythingItem[],
  query: string,
  maxTotal = OPEN_ANYTHING_MAX_RESULTS,
): OpenAnythingItem[] {
  const q = query.trim();
  if (!q) {
    const buckets = new Map<OpenAnythingKind, OpenAnythingItem[]>();
    for (const item of items) {
      const list = buckets.get(item.kind) ?? [];
      list.push(item);
      buckets.set(item.kind, list);
    }
    const out: OpenAnythingItem[] = [];
    for (const kind of GROUP_ORDER) {
      const slice = buckets.get(kind) ?? [];
      out.push(...slice.slice(0, EMPTY_GROUP_LIMIT));
    }
    return out.slice(0, maxTotal);
  }

  return items
    .map((item) => ({ item, score: scoreOpenAnythingItem(q, item) }))
    .filter(
      (row): row is { item: OpenAnythingItem; score: number } =>
        row.score != null,
    )
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.item.name.localeCompare(b.item.name);
    })
    .slice(0, maxTotal)
    .map((row) => row.item);
}

export function groupRankedOpenAnything(
  items: OpenAnythingItem[],
): Array<{ kind: OpenAnythingKind; items: OpenAnythingItem[] }> {
  const buckets = new Map<OpenAnythingKind, OpenAnythingItem[]>();
  for (const item of items) {
    const list = buckets.get(item.kind) ?? [];
    list.push(item);
    buckets.set(item.kind, list);
  }
  return GROUP_ORDER.filter((kind) => (buckets.get(kind)?.length ?? 0) > 0).map(
    (kind) => ({
      kind,
      items: buckets.get(kind)!,
    }),
  );
}

export function findSchemaTab(
  tabs: Record<string, TabContextType>,
  dbId: string,
  schema: string,
  files?: boolean,
): SchemaContextType | undefined {
  return Object.values(tabs).find((tab) => {
    if (tab.type !== 'schema') {
      return false;
    }
    const s = tab as SchemaContextType;
    return (
      s.dbId === dbId &&
      s.schema === schema &&
      Boolean(s.files) === Boolean(files)
    );
  }) as SchemaContextType | undefined;
}
