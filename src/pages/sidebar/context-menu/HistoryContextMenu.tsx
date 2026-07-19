import { docsAtom, runsAtom } from '@/stores/app';
import {
  QueryContextType,
  useTabsStore,
  type EditorContextType,
} from '@/stores/tabs';
import { Trans } from '@lingui/react/macro';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { useSetAtom } from 'jotai';
import { nanoid } from 'nanoid';
import { PropsWithChildren } from 'react';
import { toast } from 'sonner';

import { ContextMenuItem } from '@/components/custom/context-menu';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

export function HistoryContextMenu({
  children,
  ctx,
}: PropsWithChildren<{ ctx: QueryContextType }>) {
  const setItems = useSetAtom(runsAtom);
  const setDocs = useSetAtom(docsAtom);
  const append = useTabsStore((s) => s.append);
  const active = useTabsStore((s) => s.active);
  const patch = useTabsStore((s) => s.patch);
  const tabs = useTabsStore((s) => s.tabs);
  const currentId = useTabsStore((s) => s.currentId);

  const handleCopy = async () => {
    await writeText(ctx.stmt ?? '');
  };

  const handleDelete = async () => {
    setItems((prev) => prev.filter((p) => p.id != ctx.id));
  };

  /** Open SQL into a new editor tab on the same connection. */
  const handleOpenInEditor = () => {
    const stmt = ctx.stmt ?? '';
    if (!stmt.trim()) {
      toast.error('Empty SQL');
      return;
    }
    const id = nanoid();
    const tab: EditorContextType = {
      id,
      dbId: ctx.dbId,
      schema: ctx.schema,
      tableId: ctx.tableId,
      type: 'editor',
      displayName: stmt.slice(0, 40) || 'Query',
    };
    setDocs((prev) => ({ ...prev, [id]: stmt }));
    append(tab);
    active(id);
  };

  /** Fill SQL into the current editor tab (or open new if not an editor). */
  const handleFillEditor = () => {
    const stmt = ctx.stmt ?? '';
    if (!stmt.trim()) {
      toast.error('Empty SQL');
      return;
    }
    const current = currentId ? tabs[currentId] : undefined;
    if (current?.type === 'editor') {
      setDocs((prev) => ({ ...prev, [current.id]: stmt }));
      if (ctx.dbId && current.dbId !== ctx.dbId) {
        patch(current.id, {
          dbId: ctx.dbId,
          schema: ctx.schema,
          tableId: ctx.tableId,
        } as Partial<EditorContextType>);
      }
      active(current.id);
    } else {
      handleOpenInEditor();
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-64">
        <ContextMenuItem onSelect={handleFillEditor}>
          <Trans>Open in editor</Trans>
        </ContextMenuItem>
        <ContextMenuItem onSelect={handleOpenInEditor}>
          <Trans>Open in new editor</Trans>
        </ContextMenuItem>
        <ContextMenuItem onSelect={handleCopy}>
          <Trans>Copy</Trans>
        </ContextMenuItem>
        <ContextMenuItem onSelect={handleDelete}>
          <Trans>Delete</Trans>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
