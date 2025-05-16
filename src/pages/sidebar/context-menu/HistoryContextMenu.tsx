import { runsAtom } from '@/stores/app';
import { QueryContextType } from '@/stores/tabs';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { useSetAtom } from 'jotai';
import { PropsWithChildren } from 'react';

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

  const handleCopy = async (e: Event) => {
    e.stopPropagation();
    await writeText(ctx.stmt ?? '');
  };
  const handleDelete = async (e: Event) => {
    e.stopPropagation();
    setItems((prev) => prev.filter((p) => p.id != ctx.id));
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-64">
        <ContextMenuItem onSelect={handleCopy}>Copy</ContextMenuItem>{' '}
        <ContextMenuItem onSelect={handleDelete}>Delete</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
