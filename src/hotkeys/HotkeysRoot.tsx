import { HotkeysProvider } from '@tanstack/react-hotkeys';
import { useAtom } from 'jotai';
import { nanoid } from 'nanoid';
import { useCallback, useState, type ReactNode } from 'react';

import { activeSideAtom } from '@/pages/sidebar/aside';
import {
  getStoredDB,
  useDBListStore,
  useSelectedNodeStore,
  type NodeContextType,
} from '@/stores/dbList';
import { useTabsStore } from '@/stores/tabs';

import { HotkeysHelpDialog } from './HotkeysHelpDialog';
import { useAppHotkey } from './useAppHotkey';

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  if (target.closest('.monaco-editor')) return true;
  return false;
}

function isConnectionRoot(node: NodeContextType | null): boolean {
  if (!node?.dbId) return false;
  if (!node.tableId) return true;
  if (node.tableId === node.dbId) return true;
  if (node.type === 'root' || node.type === 'database') return true;
  return false;
}

/**
 * Global + tree-scoped hotkey bindings.
 * Editor run/format stay in Monaco (displayOnly in registry).
 */
function HotkeysBindings({ children }: { children: ReactNode }) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [, setActiveSide] = useAtom(activeSideAtom);
  const selectedNode = useSelectedNodeStore((s) => s.selectedNode);
  const updateDB = useDBListStore((s) => s.updateByConfig);
  const updateTab = useTabsStore((s) => s.update);
  const removeTab = useTabsStore((s) => s.remove);
  const currentId = useTabsStore((s) => s.currentId);
  const tabs = useTabsStore((s) => s.tabs);

  const treeEnabled = !!selectedNode && !helpOpen;

  useAppHotkey('sidebar.toggle', () => {
    setActiveSide((prev) => (prev == null ? 'database' : null));
  });

  useAppHotkey('hotkeys.help', () => {
    setHelpOpen((o) => !o);
  });

  useAppHotkey(
    'tab.close',
    () => {
      if (!currentId) return;
      const tab = tabs[currentId];
      removeTab(currentId, tab?.type === 'editor');
    },
    { enabled: !!currentId },
  );

  const withTreeGuard = useCallback(
    (fn: () => void) => (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      if (!selectedNode) return;
      fn();
    },
    [selectedNode],
  );

  const emitTreeHotkey = useCallback(
    (action: string) => {
      window.dispatchEvent(
        new CustomEvent('duckling:tree-hotkey', {
          detail: { action, node: selectedNode },
        }),
      );
    },
    [selectedNode],
  );

  useAppHotkey(
    'connection.rename',
    withTreeGuard(() => {
      if (!isConnectionRoot(selectedNode)) return;
      emitTreeHotkey('rename');
    }),
    { enabled: treeEnabled },
  );

  useAppHotkey(
    'connection.properties',
    withTreeGuard(() => {
      emitTreeHotkey('properties');
    }),
    { enabled: treeEnabled },
  );

  useAppHotkey(
    'connection.editor',
    withTreeGuard(() => {
      if (!selectedNode?.dbId) return;
      const db = getStoredDB(selectedNode.dbId);
      updateTab({
        id: nanoid(),
        dbId: selectedNode.dbId,
        displayName: db?.displayName ?? selectedNode.dbId,
        type: 'editor',
      });
    }),
    { enabled: treeEnabled },
  );

  useAppHotkey(
    'tree.refresh',
    withTreeGuard(() => {
      if (!selectedNode?.dbId) return;
      const latest = getStoredDB(selectedNode.dbId);
      if (!latest) return;
      void updateDB(
        selectedNode.dbId,
        latest.config ?? {
          path: latest.data?.path ?? '',
          dialect: latest.dialect ?? 'folder',
        },
      );
    }),
    { enabled: treeEnabled },
  );

  useAppHotkey(
    'tree.delete',
    withTreeGuard(() => {
      if (!isConnectionRoot(selectedNode)) return;
      emitTreeHotkey('delete');
    }),
    { enabled: treeEnabled },
  );

  return (
    <>
      {children}
      <HotkeysHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </>
  );
}

export function HotkeysRoot({ children }: { children: ReactNode }) {
  return (
    <HotkeysProvider
      defaultOptions={{
        hotkey: {
          preventDefault: true,
          ignoreInputs: false,
        },
      }}
    >
      <HotkeysBindings>{children}</HotkeysBindings>
    </HotkeysProvider>
  );
}
