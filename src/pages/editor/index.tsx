import { OnChange } from '@monaco-editor/react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { focusAtom } from 'jotai-optics';
import { nanoid } from 'nanoid';
import { useRef, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';

import MonacoEditor, { EditorRef } from '@/components/editor/MonacoEditor';
import VerticalContainer from '@/components/VerticalContainer';
import { docsAtom, runsAtom } from '@/stores/app';
import { DBType, schemaMapAtom } from '@/stores/dbList';
import {
  EditorContextType,
  QueryContextType,
  TabContextType,
  activeTabAtom,
  getDatabase,
  subTabsAtomFamily,
  useTabsStore,
} from '@/stores/tabs';

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
  const { id, dbId } = context;
  const db = getDatabase(dbId);

  const [docs, setDocs] = useAtom(docsAtom);
  const currentTab = useAtomValue(activeTabAtom);

  const tabAtom = subTabsAtomFamily({ id, children: [] });
  tabAtom.debugLabel = `tabAtom-${id}`;

  const [tab, setTab] = useAtom(tabAtom);

  const subTabsAtom = focusAtom(tabAtom, (o) => o.prop('children'));
  const setSubTabs = useSetAtom(subTabsAtom);
  const [hasLimit, setHasLimit] = useState(true);

  const stmt = docs[id] ?? '';

  const schemaMap = useAtomValue(schemaMapAtom);

  const tableSchema = schemaMap.get(dbId);
  const ref = useRef<EditorRef | null>(null);

  const handleChange: OnChange = (value, _event) => {
    setDocs((prev) => ({ ...prev, [id]: value ?? '' }));
  };

  const setActiveKey = (key?: string) => {
    setTab((item) => ({ ...item, activeKey: key }));
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
  const handleClick = async (action?: string) => {
    const stmt = getStmt();
    const id = `${tab.id}@${nanoid()}`;
    if (action == 'new' || tab.children.length == 0) {
      const subContext: QueryContextType = createStore({
        dbId,
        schema: context.schema,
        tableId: context.tableId,
        type: 'query',
        stmt,
        hasLimit,
        displayName: `Result${(tab?.children?.length ?? 0) + 1}`,
        id,
      });
      setRuns((prev) => [...(prev ?? []), subContext]);
      setSubTabs((prev) => [...(prev ?? []), subContext]);
    } else {
      setSubTabs((tabs) =>
        (tabs ?? []).map((item) => {
          if (item.id == tab.activeKey) {
            item = { ...item, stmt, id, dbId, page: 1, perPage: 500, hasLimit };
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
    setTab((item) => ({ ...item, activeKey: id }));
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
      />
      <VerticalContainer bottom={tab.children.length > 0 ? 300 : undefined}>
        <div className="h-full flex flex-col overflow-hidden border-b">
          <MonacoEditor
            ref={ref}
            value={stmt}
            language="sql"
            onChange={handleChange}
            completeMeta={{
              tables: tableSchema,
              defaultDatabase: db?.defaultDatabase,
            }}
            onRun={handleClick}
          />
        </div>
        <QueryTabs tabsAtom={subTabsAtom} activeKey={tab.activeKey} setActiveKey={setActiveKey} />
      </VerticalContainer>
    </div>
  );
}
