import { nanoid } from 'nanoid';

import { createScratchEditor, readScratch } from '@/lib/scratchSql';
import {
  findSchemaTab,
  type OpenAnythingPayload,
} from '@/lib/openAnything';
import { openSqlWorkspaceFile } from '@/lib/openSqlWorkspaceFile';
import type {
  SchemaContextType,
  TableContextType,
  TabContextType,
} from '@/stores/tabs';

export type OpenAnythingActionContext = {
  tabs: Record<string, TabContextType>;
  updateTab: (tab: TabContextType) => void;
  append: (tab: TabContextType) => void;
  active: (id: string) => void;
  setDocs: (
    updater: (prev: Record<string, string>) => Record<string, string>,
  ) => void;
  docs: Record<string, string>;
  revealInSidebar: (tab: TabContextType) => void;
  resolveDbId: () => string;
};

export async function executeOpenAnythingPayload(
  payload: OpenAnythingPayload,
  ctx: OpenAnythingActionContext,
): Promise<void> {
  switch (payload.kind) {
    case 'connection': {
      const tab: TableContextType = {
        id: `${payload.dbId}:${payload.rootPath}`,
        dbId: payload.dbId,
        tableId: payload.rootPath,
        displayName: payload.displayName,
        type: 'table',
      };
      ctx.revealInSidebar(tab);
      return;
    }
    case 'database': {
      const existing = findSchemaTab(
        ctx.tabs,
        payload.dbId,
        payload.schemaPath,
        false,
      );
      if (existing) {
        ctx.updateTab(existing);
        return;
      }
      const item: SchemaContextType = {
        id: nanoid(),
        dbId: payload.dbId,
        schema: payload.schemaPath,
        displayName: payload.displayName,
        type: 'schema',
      };
      ctx.updateTab(item);
      return;
    }
    case 'schemaFiles': {
      const existing = findSchemaTab(
        ctx.tabs,
        payload.dbId,
        payload.schemaPath,
        true,
      );
      if (existing) {
        ctx.updateTab(existing);
        return;
      }
      const item: SchemaContextType = {
        id: nanoid(),
        dbId: payload.dbId,
        schema: payload.schemaPath,
        files: true,
        displayName: payload.displayName,
        type: 'schema',
      };
      ctx.updateTab(item);
      return;
    }
    case 'table': {
      const item: TableContextType = {
        id: payload.nodeId,
        dbId: payload.dbId,
        tableId: payload.path,
        displayName: payload.displayName,
        type: 'table',
      };
      ctx.updateTab(item);
      return;
    }
    case 'favorite': {
      ctx.updateTab(payload.tab);
      return;
    }
    case 'bookmark': {
      const b = payload.bookmark;
      const { tab, content } = await createScratchEditor({
        dbId: b.dbId,
        displayName: b.title || b.id,
        content: b.stmt,
      });
      ctx.setDocs((prev) => ({ ...prev, [tab.id]: content }));
      ctx.append(tab);
      ctx.active(tab.id);
      return;
    }
    case 'scratch': {
      const tab = payload.tab;
      if (ctx.docs[tab.id] == null) {
        const body = await readScratch(tab.id);
        ctx.setDocs((prev) =>
          prev[tab.id] != null ? prev : { ...prev, [tab.id]: body },
        );
      }
      ctx.updateTab(tab);
      return;
    }
    case 'sqlFile': {
      await openSqlWorkspaceFile(
        { path: payload.path, name: payload.name },
        {
          tabs: ctx.tabs,
          updateTab: ctx.updateTab,
          setDocs: ctx.setDocs,
          resolveDbId: () => payload.dbId || ctx.resolveDbId(),
        },
      );
      return;
    }
    default:
      return;
  }
}
