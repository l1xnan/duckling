import { OnChange } from '@monaco-editor/react';
import { useLingui } from '@lingui/react/macro';
import { useAtom, useSetAtom } from 'jotai';
import { nanoid } from 'nanoid';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  analyzeSqlTemplate,
  expandSqlTemplate,
  writeTextFile,
  type ExpandedStatement,
} from '@/api';
import MonacoEditor, { EditorRef } from '@/components/editor/MonacoEditor';
import {
  MacroRunDialog,
  type MacroRunSubmit,
} from '@/components/views/MacroRunDialog';
import VerticalContainer from '@/components/VerticalContainer';
import { useAppHotkey } from '@/hotkeys';
import { connectionRef } from '@/lib/connectionRef';
import type { QueryHistoryItem } from '@/lib/queryHistory';
import {
  flushWriteScratch,
  isScratchPath,
  readScratch,
  scheduleWriteScratch,
} from '@/lib/scratchSql';
import { buildExplainSql } from '@/lib/sql/sample';
import {
  applyVarsToSql,
  buildVarsScaffold,
  formatMacroLabel,
  mergeMacroValues,
} from '@/lib/sql/macros';
import { bookmarksAtom, docsAtom, runsAtom } from '@/stores/app';
import { DBType, useConnection, useConnectionMeta } from '@/stores/dbList';
import { useEditorDirtyStore } from '@/stores/editorDirty';
import {
  EditorContextType,
  QueryContextType,
  useQuerySessionStore,
  useTabsStore,
} from '@/stores/tabs';
import { toast } from 'sonner';

import { EditorToolbar } from './EditorToolbar';
import { QueryTabs } from './QueryTabs';

const SOFT_EXPAND_LIMIT = 20;
const HARD_EXPAND_LIMIT = 50;

type SqlSourceRange = {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
};

type MacroPromptState = {
  placeholders: string[];
  missing: string[];
  provided: Record<string, string[]>;
  resolve: (result: MacroRunSubmit | null) => void;
};

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
  const { id, dbId, path } = context;
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
  const [saving, setSaving] = useState(false);

  const stmt = docs[id] ?? '';
  const ref = useRef<EditorRef | null>(null);
  const savedBaselineRef = useRef<string | null>(null);
  const scratch = isScratchPath(path);
  /** User-owned SQL file from a local folder (explicit save). */
  const fileBacked = !!path && !scratch;
  const dirty = useEditorDirtyStore((s) => !!s.dirty[id]);
  const setDirty = useEditorDirtyStore((s) => s.setDirty);
  const clearDirty = useEditorDirtyStore((s) => s.clear);

  useEffect(() => {
    if (!scratch) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const current = docs[id];
      if (current != null) {
        return;
      }
      const body = await readScratch(id);
      if (cancelled) {
        return;
      }
      setDocs((prev) => (prev[id] != null ? prev : { ...prev, [id]: body }));
    })();
    return () => {
      cancelled = true;
      void flushWriteScratch(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on editor identity
  }, [id, path, scratch]);

  // Folder SQL: capture baseline when content first appears in cache.
  useEffect(() => {
    if (!fileBacked) {
      return;
    }
    if (savedBaselineRef.current != null) {
      return;
    }
    if (docs[id] == null) {
      return;
    }
    savedBaselineRef.current = docs[id];
    setDirty(id, false);
  }, [fileBacked, id, docs, setDirty]);

  useEffect(() => {
    return () => {
      clearDirty(id);
    };
  }, [id, clearDirty]);

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

  const persistDoc = (value: string) => {
    setDocs((prev) => ({ ...prev, [id]: value }));
    if (scratch) {
      scheduleWriteScratch(id, value);
    } else if (fileBacked) {
      if (savedBaselineRef.current == null) {
        savedBaselineRef.current = value;
      }
      setDirty(id, value !== savedBaselineRef.current);
    }
  };

  const handleChange: OnChange = (value, _event) => {
    persistDoc(value ?? '');
  };

  const handleSave = async () => {
    if (!fileBacked || !path || saving) {
      return;
    }
    const content = ref.current?.getValue() ?? docs[id] ?? '';
    setSaving(true);
    try {
      await writeTextFile(path, content);
      savedBaselineRef.current = content;
      setDocs((prev) => ({ ...prev, [id]: content }));
      setDirty(id, false);
      toast.success(t`Saved`);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSaving(false);
    }
  };

  const setActiveKey = (key?: string) => {
    setActiveKeyStore(id, key);
  };

  const getStmt = ():
    | {
        stmt: string;
        sourceRange: {
          startLineNumber: number;
          startColumn: number;
          endLineNumber: number;
          endColumn: number;
        };
      }
    | undefined => {
    const editor = ref.current;
    const monaco = editor?.editor();
    const model = monaco?.getModel();
    if (!editor || !monaco || !model) {
      return;
    }

    const selection = monaco.getSelection();
    const hasSel = selection && !selection.isEmpty();
    if (hasSel && selection) {
      const stmt = model.getValueInRange(selection);
      if (!stmt.trim()) {
        return;
      }
      return {
        stmt,
        sourceRange: {
          startLineNumber: selection.startLineNumber,
          startColumn: selection.startColumn,
          endLineNumber: selection.endLineNumber,
          endColumn: selection.endColumn,
        },
      };
    }

    const stmt = editor.getValue() ?? '';
    if (!stmt.trim()) {
      return;
    }
    const lineCount = model.getLineCount();
    return {
      stmt,
      sourceRange: {
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: lineCount,
        endColumn: model.getLineMaxColumn(lineCount),
      },
    };
  };

  const setRuns = useSetAtom(runsAtom);
  const setBookmarks = useSetAtom(bookmarksAtom);

  const handleBookmark = () => {
    const got = getStmt();
    const sql = got?.stmt ?? stmt;
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
    const got = getStmt();
    const sql = got?.stmt ?? stmt;
    if (!sql?.trim()) {
      toast.error(t`Empty SQL`);
      return;
    }
    const dialect = db?.dialect ?? 'generic';
    const explained = buildExplainSql(sql, dialect, analyze);
    persistDoc(explained);
  };

  const [macroPrompt, setMacroPrompt] = useState<MacroPromptState | null>(
    null,
  );
  const macroRememberRef = useRef<Record<string, string[]>>({});
  const writeVarsPrefRef = useRef(true);

  const writeSqlToEditor = useCallback(
    (nextSql: string, sourceRange: SqlSourceRange, hadSelection: boolean) => {
      const editor = ref.current;
      const monaco = editor?.editor();
      const model = monaco?.getModel();
      if (hadSelection && monaco && model) {
        monaco.executeEdits('insert-vars', [
          {
            range: {
              startLineNumber: sourceRange.startLineNumber,
              startColumn: sourceRange.startColumn,
              endLineNumber: sourceRange.endLineNumber,
              endColumn: sourceRange.endColumn,
            },
            text: nextSql,
          },
        ]);
        persistDoc(monaco.getValue() ?? nextSql);
      } else {
        persistDoc(nextSql);
      }
    },
    // persistDoc closes over id/path; recreate when those change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, path, scratch, fileBacked],
  );

  const promptMacroValues = useCallback(
    (args: {
      placeholders: string[];
      missing: string[];
      provided: Record<string, string[]>;
    }) =>
      new Promise<MacroRunSubmit | null>((resolve) => {
        setMacroPrompt({
          ...args,
          resolve: (result) => {
            setMacroPrompt(null);
            resolve(result);
          },
        });
      }),
    [],
  );

  const handleInsertVarsTemplate = async () => {
    const got = getStmt();
    if (!got?.stmt?.trim()) {
      toast.error(t`Empty SQL`);
      return;
    }
    try {
      const analysis = await analyzeSqlTemplate(got.stmt);
      if (analysis.placeholders.length === 0) {
        toast.error(t`No template variables found`);
        return;
      }
      const hadSelection = !!ref.current?.hasSelection();
      const hadPriorVars = Object.keys(analysis.provided).length > 0;
      const scaffold = buildVarsScaffold(
        analysis.placeholders,
        analysis.provided,
      );
      const next = applyVarsToSql(
        analysis.templateBody,
        scaffold,
        analysis.placeholders,
      );
      writeSqlToEditor(next, got.sourceRange, hadSelection);
      toast.success(
        hadPriorVars
          ? t`Updated @vars template`
          : t`Inserted @vars template`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg);
    }
  };

  const spawnResultTabs = useCallback(
    (
      statements: ExpandedStatement[],
      sourceRange: SqlSourceRange,
      action?: string,
    ) => {
      const multi = statements.length > 1;
      const currentActive = useQuerySessionStore.getState().byEditor[id]
        ?.activeKey;
      let baseCount = childCount;

      const historyEntry = (entry: {
        id: string;
        stmt: string;
        displayName: string;
      }): QueryHistoryItem => ({
        id: entry.id,
        type: 'query',
        dbId,
        schema: context.schema,
        tableId: context.tableId,
        stmt: entry.stmt,
        hasLimit,
        createdAt: Date.now(),
        displayName: entry.displayName,
      });

      let lastId = '';
      statements.forEach((item, index) => {
        const childId = `${id}@${nanoid()}`;
        lastId = childId;
        const label = formatMacroLabel(item.binding);
        baseCount += 1;
        const displayName = label
          ? t`Result · ${label}`
          : t`Result${baseCount}`;

        const reuse =
          !multi &&
          index === 0 &&
          action !== 'new' &&
          childCount > 0 &&
          currentActive;

        if (reuse) {
          setChildren(id, (tabs) =>
            (tabs ?? []).map((tab) => {
              if (tab.id === currentActive) {
                return {
                  ...tab,
                  stmt: item.sql,
                  id: childId,
                  dbId,
                  page: 1,
                  perPage: 500,
                  hasLimit,
                  editorId: id,
                  sourceRange,
                  displayName,
                };
              }
              return tab;
            }),
          );
        } else {
          const subContext: QueryContextType = createStore({
            dbId,
            schema: context.schema,
            tableId: context.tableId,
            type: 'query',
            stmt: item.sql,
            hasLimit,
            displayName,
            id: childId,
            editorId: id,
            sourceRange,
          });
          appendChild(id, subContext);
        }

        setRuns((prev) => [
          historyEntry({ id: childId, stmt: item.sql, displayName }),
          ...(prev ?? []),
        ]);
      });

      if (lastId) {
        setActiveKey(lastId);
      }
    },
    [
      appendChild,
      childCount,
      context.schema,
      context.tableId,
      dbId,
      hasLimit,
      id,
      setActiveKey,
      setChildren,
      setRuns,
      t,
    ],
  );

  const handleClick = async (action?: string) => {
    const got = getStmt();
    if (!got?.stmt?.trim()) {
      toast.error(t`Empty SQL`);
      return;
    }
    const { stmt: rawStmt, sourceRange } = got;

    let statements: ExpandedStatement[];
    try {
      const analysis = await analyzeSqlTemplate(rawStmt);
      if (!analysis.hasTemplate) {
        statements = [{ sql: rawStmt, binding: {} }];
      } else {
        let expandSource = rawStmt;
        let overrides: Record<string, string[]> | undefined;

        if (analysis.missing.length > 0) {
          const filled = await promptMacroValues({
            placeholders: analysis.placeholders,
            missing: analysis.missing,
            provided: analysis.provided,
          });
          if (!filled) {
            return;
          }
          writeVarsPrefRef.current = filled.writeVars;
          macroRememberRef.current = {
            ...macroRememberRef.current,
            ...filled.values,
          };

          const merged = mergeMacroValues(
            analysis.provided,
            filled.values,
          );

          if (filled.writeVars) {
            const next = applyVarsToSql(
              analysis.templateBody,
              merged,
              analysis.placeholders,
            );
            writeSqlToEditor(
              next,
              sourceRange,
              !!ref.current?.hasSelection(),
            );
            expandSource = next;
            overrides = undefined;
          } else {
            overrides = filled.values;
          }
        }

        const expanded = await expandSqlTemplate(expandSource, overrides);
        statements = expanded.statements;
        if (statements.length === 0) {
          toast.error(t`Empty SQL`);
          return;
        }
        if (statements.length > HARD_EXPAND_LIMIT) {
          const limit = HARD_EXPAND_LIMIT;
          toast.error(
            t`Too many combinations (${statements.length}); limit is ${limit}`,
          );
          return;
        }
        if (statements.length > SOFT_EXPAND_LIMIT) {
          const ok = window.confirm(
            t`This will run ${statements.length} queries. Continue?`,
          );
          if (!ok) {
            return;
          }
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg);
      return;
    }

    spawnResultTabs(statements, sourceRange, action);
  };

  // Run (Mod+Enter) is bound only in Monaco to avoid double-fire.
  useAppHotkey(
    'editor.runNewTab',
    () => {
      void handleClick('new');
    },
    { enabled: currentTab === id },
  );

  useAppHotkey(
    'editor.save',
    () => {
      void handleSave();
    },
    { enabled: currentTab === id && fileBacked },
  );

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
        onInsertVarsTemplate={() => {
          void handleInsertVarsTemplate();
        }}
        onSave={() => {
          void handleSave();
        }}
        canSave={fileBacked}
        dirty={dirty}
      />
      <VerticalContainer bottom={childCount > 0 ? 300 : undefined}>
        <div className="h-full flex flex-col overflow-hidden border-b">
          <MonacoEditor
            ref={ref}
            editorId={id}
            value={stmt}
            language="sql"
            onChange={handleChange}
            dialect={db?.dialect}
            completeMeta={{
              tables: tableSchema,
              defaultDatabase: db?.defaultDatabase,
              dialect: connectionRef(dbId),
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
      {macroPrompt ? (
        <MacroRunDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              macroPrompt.resolve(null);
            }
          }}
          placeholders={macroPrompt.placeholders}
          missing={macroPrompt.missing}
          provided={macroPrompt.provided}
          remembered={macroRememberRef.current}
          defaultWriteVars={writeVarsPrefRef.current}
          onSubmit={(result) => {
            macroPrompt.resolve(result);
          }}
        />
      ) : null}
    </div>
  );
}
