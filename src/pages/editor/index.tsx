import { OnChange } from '@monaco-editor/react';
import { useLingui } from '@lingui/react/macro';
import { useAtom, useSetAtom } from 'jotai';
import { nanoid } from 'nanoid';
import { useRef, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';

import MonacoEditor, { EditorRef } from '@/components/editor/MonacoEditor';
import VerticalContainer from '@/components/VerticalContainer';
import { bookmarksAtom, docsAtom, runsAtom } from '@/stores/app';
import { buildExplainSql } from '@/lib/sql/sample';
import { DBType, useConnection, useConnectionMeta } from '@/stores/dbList';
import {
  EditorContextType,
  QueryContextType,
  TabContextType,
  useQuerySessionStore,
  useTabsStore,
} from '@/stores/tabs';
import { toast } from 'sonner';

import { EditorToolbar } from './EditorToolbar';
import { QueryTabs } from './QueryTabs';

function createStore(item: Partial<QueryContextType>) {
  return {
    page: 1,
    perPage: 500,
    totalCount: 0,
    ...item,
  } as QueryContextType;
}

export default function Editor({ context }: { context: EditorContextType }) {
  const { t } = useLingui();
  const { id, dbId } = context;
  const db = useConnection(dbId);
  const tableSchema = useConnectionMeta(dbId);

  const [docs, setDocs] = useAtom(docsAtom);
  const currentTab = useTabsStore((s) => s.currentId);

  const activeKey = useQuerySessionStore((s) => s.byEditor[id]?.activeKey);
  const childCount = useQuerySessionStore(
    (s) => s.byEditor[id]?.order.length ?? 0,
  );
  const setActiveKeyStore = useQuerySessionStore((s) => s.setActiveKey);
  const setChildren = useQuerySessionStore((s) => s.setChildren);
  const appendChild = useQuerySessionStore((s) => s.appendChild);

  const [hasLimit, setHasLimit] = useState(true);
  const [canFormatSelection, setCanFormatSelection] = useState(false);

  const stmt = docs[id] ?? '';
  const ref = useRef<EditorRef | null>(null);

  const syncSelectionState = () => {
    setCanFormatSelection(!!ref.current?.hasSelection());
  };

  const handleFormat = (scope: 'document' | 'selection') => {
    if (scope === 'selection') {
      void ref.current?.formatSelection();
    } else {
      void ref.current?.formatDocument();
    }
  };

  const handleChange: OnChange = (value, _event) => {
    setDocs((prev) => ({ ...prev, [id]: value ?? '' }));
  };

  const setActiveKey = (key?: string) => {
    setActiveKeyStore(id, key);
  };

  const getStmt = () => {
    const editor = ref.current;
    if (!editor) {
      return;
    }

    let stmt = editor.getSelectionText() ?? '';

    if (stmt.length === 0) {
      stmt = editor.getValue() ?? '';
    }

    if (stmt.length === 0) {
      return;
    }
    return stmt;
  };

  const setRuns = useSetAtom(runsAtom);
  const setBookmarks = useSetAtom(bookmarksAtom);

  const handleBookmark = () => {
    const sql = getStmt() ?? stmt;
    if (!sql?.trim()) {
      toast.error(t`Empty SQL`);
      return;
    }
    setBookmarks((prev) => [
      {
        id: nanoid(),
        dbId,
        stmt: sql,
        title: sql.trim().slice(0, 48),
        createdAt: Date.now(),
      },
      ...(prev ?? []),
    ]);
    toast.success(t`Bookmarked`);
  };

  const handleExplain = (analyze = false) => {
    const sql = getStmt() ?? stmt;
    if (!sql?.trim()) {
      toast.error(t`Empty SQL`);
      return;
    }
    const dialect = db?.dialect ?? 'generic';
    const explained = buildExplainSql(sql, dialect, analyze);
    setDocs((prev) => ({ ...prev, [id]: explained }));
  };

  const handleClick = async (action?: string) => {
    const stmt = getStmt();
    const childId = `${id}@${nanoid()}`;
    const currentActive = useQuerySessionStore.getState().byEditor[id]
      ?.activeKey;

    if (action == 'new' || childCount == 0) {
      const subContext: QueryContextType = createStore({
        dbId,
        schema: context.schema,
        tableId: context.tableId,
        type: 'query',
        stmt,
        hasLimit,
        displayName: t`Result${childCount + 1}`,
        id: childId,
      });
      setRuns((prev) => [...(prev ?? []), subContext]);
      appendChild(id, subContext);
    } else {
      setChildren(id, (tabs) =>
        (tabs ?? []).map((item) => {
          if (item.id == currentActive) {
            item = {
              ...item,
              stmt,
              id: childId,
              dbId,
              page: 1,
              perPage: 500,
              hasLimit,
            };
            setRuns((prev) => [
              ...(prev ?? []),
              {
                dbId,
                tableId: item.tableId,
                type: 'query',
                stmt: item.stmt,
                hasLimit: item.hasLimit,
              } as TabContextType,
            ]);
          }
          return item;
        }),
      );
    }
    setActiveKey(childId);
  };

  useHotkeys('ctrl+enter', () => handleClick(), { enabled: currentTab == id });

  const setSession = useTabsStore((s) => s.setSession);
  const handleSession = (db: DBType) => {
    setSession({
      ...context,
      displayName: db.displayName,
      dbId: db.id,
    });
  };

  return (
    <div className="h-full w-full overflow-hidden flex flex-col">
      <EditorToolbar
        onClick={handleClick}
        session={db?.displayName}
        setSession={handleSession}
        onHasLimit={setHasLimit}
        hasLimit={hasLimit}
        onFormat={handleFormat}
        canFormatSelection={canFormatSelection}
        onBookmark={handleBookmark}
        onExplain={handleExplain}
      />
      <VerticalContainer bottom={childCount > 0 ? 300 : undefined}>
        <div className="h-full flex flex-col overflow-hidden border-b">
          <MonacoEditor
            ref={ref}
            value={stmt}
            language="sql"
            onChange={handleChange}
            dialect={db?.dialect}
            completeMeta={{
              tables: tableSchema,
              defaultDatabase: db?.defaultDatabase,
            }}
            onRun={handleClick}
            onMount={(editor) => {
              syncSelectionState();
              editor.onDidChangeCursorSelection(() => {
                syncSelectionState();
              });
            }}
          />
        </div>
        <QueryTabs
          editorId={id}
          activeKey={activeKey}
          setActiveKey={setActiveKey}
        />
      </VerticalContainer>
    </div>
  );
}
