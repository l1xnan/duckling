import { Data, Vector } from '@apache-arrow/ts';
import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import MonacoEditor from '@monaco-editor/react';

import { ChevronsDownUpIcon, ChevronsUpDownIcon, LetterTextIcon, PanelBottomIcon, PanelRightIcon, XIcon } from 'lucide-react';
import { editor } from 'monaco-editor';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { arrowToJSON } from '@/api';
import { DropdownMenu, DropdownMenuItem } from '@/components/custom/dropdown-menu';
import { TooltipButton } from '@/components/custom/tooltip';
import { DropdownMenuContent } from '@/components/custom/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/custom/ui/tabs';
import ErrorBoundary from '@/components/ErrorBoundary';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { formatRecordAsJson } from '@/lib/recordJson';
import { cn } from '@/lib/utils';
import { Direction } from '@/stores/dataset';
import {
  useCodeFontFamily,
  useCodeFontSize,
  useEditorTheme,
} from '@/stores/setting';
import { DataFrame } from '@/utils/dataframe';

import { SelectedCellType } from './TableView';

const FORMAT_OPTIONS: { value: string; label: MessageDescriptor | string }[] = [
  { value: 'Raw', label: msg`Raw` },
  { value: 'JSON', label: 'JSON' },
  { value: 'Raw(JSON)', label: msg`Raw(JSON)` },
];

type ViewerTab = 'value' | 'record' | 'calculate';

const RECORD_JSON_FOLD_LEVEL = 2;
const FOLDING_CONTROLLER_ID = 'editor.contrib.folding';

type FoldingContribution = {
  getFoldingModel(): Promise<{ regions: { length: number } } | null> | null;
};

function getFoldingRegionCount(ed: editor.IStandaloneCodeEditor): Promise<number> {
  const contribution = ed.getContribution(
    FOLDING_CONTROLLER_ID,
  ) as FoldingContribution | null;
  const promise = contribution?.getFoldingModel();
  if (!promise) return Promise.resolve(0);
  return promise.then((model) => model?.regions.length ?? 0);
}

type RecordJsonFoldMode = 'compact' | 'expanded';

function runRecordJsonFolding(
  ed: editor.IStandaloneCodeEditor,
  mode: RecordJsonFoldMode,
): () => void {
  let cancelled = false;

  const run = async (attempt: number) => {
    if (cancelled) return;

    ed.layout();
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

    const regionCount = await getFoldingRegionCount(ed);

    if (regionCount === 0 && attempt < 12) {
      await new Promise((r) => setTimeout(r, Math.min(80 * (attempt + 1), 400)));
      return run(attempt + 1);
    }
    if (cancelled) return;

    const model = ed.getModel();
    if (mode === 'compact') {
      if (model) {
        const lastLine = model.getLineCount();
        const lastColumn = model.getLineMaxColumn(lastLine);
        ed.setSelection({
          startLineNumber: lastLine,
          startColumn: lastColumn,
          endLineNumber: lastLine,
          endColumn: lastColumn,
        });
      }
      await ed.getAction(`editor.foldLevel${RECORD_JSON_FOLD_LEVEL}`)?.run();
    } else {
      await ed.getAction('editor.unfoldAll')?.run();
    }

    if (model) {
      ed.setSelection({
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: 1,
        endColumn: 1,
      });
      ed.revealLine(1);
    }
  };

  void run(0);
  return () => {
    cancelled = true;
  };
}

interface FormatTypeDropdownProps {
  type: string;
  setType: (type: string) => void;
}

export function FormatTypeDropdown({ type, setType }: FormatTypeDropdownProps) {
  const { t } = useLingui();
  const current = FORMAT_OPTIONS.find((item) => item.value === type);
  const content =
    current == null
      ? type
      : typeof current.label === 'string'
        ? current.label
        : t(current.label);

  return (
    <DropdownMenu content={content}>
      <DropdownMenuContent className="w-32">
        {FORMAT_OPTIONS.map((item) => (
          <DropdownMenuItem
            key={item.value}
            onSelect={() => {
              setType(item.value);
            }}
          >
            {typeof item.label === 'string' ? item.label : t(item.label)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface ValueViewerProps {
  selectedCell?: SelectedCellType | null;
  selectedCellInfos?: SelectedCellType[][] | null;
  setShowValue: () => void;
  setDirection: () => void;
  direction: Direction;
}

function displayValue(value: Data, type: string) {
  if (value === null || value === undefined) {
    return value;
  }
  if (type === 'JSON') {
    return arrowToJSON(value);
  }
  if (type === 'Raw(JSON)') {
    return value.toString();
  }
  if (value instanceof Vector) {
    return arrowToJSON(value, 0);
  }
  return value.toString();
}

const monacoBaseOptions: editor.IStandaloneEditorConstructionOptions = {
  minimap: { enabled: false },
  wordWrap: 'on',
  tabSize: 2,
};

export function ValueViewer({
  selectedCell,
  selectedCellInfos,
  setShowValue,
  setDirection,
  direction,
}: ValueViewerProps) {
  const { t } = useLingui();
  const theme = useEditorTheme();
  const codeFontFamily = useCodeFontFamily();
  const codeFontSize = useCodeFontSize();

  const [activeTab, setActiveTab] = useState<ViewerTab>('value');
  const [type, setType] = useState('Raw');
  const [recordFoldMode, setRecordFoldMode] = useState<RecordJsonFoldMode>('expanded');
  const valueEditorRef = useRef<editor.IStandaloneCodeEditor>(null);
  const recordEditorRef = useRef<editor.IStandaloneCodeEditor>(null);

  useEffect(() => {
    valueEditorRef.current?.updateOptions({
      fontFamily: codeFontFamily,
      fontSize: codeFontSize,
    });
    recordEditorRef.current?.updateOptions({
      fontFamily: codeFontFamily,
      fontSize: codeFontSize,
    });
  }, [codeFontFamily, codeFontSize]);

  const handleFormat = () => {
    if (!valueEditorRef.current) return;
    try {
      valueEditorRef.current?.getAction('editor.action.formatDocument')?.run();
    } catch (error) {
      console.error('格式化失败:', error);
    }
  };

  const value = useMemo(
    () => displayValue(selectedCell?.value as Data, type),
    [selectedCell?.value, type],
  );

  const recordJson = useMemo(() => {
    const record = selectedCell?.record;
    if (!record || typeof record !== 'object') {
      return '';
    }
    return formatRecordAsJson(record);
  }, [selectedCell?.record]);

  useEffect(() => {
    setRecordFoldMode('expanded');
  }, [recordJson]);

  const mountRecordEditor = useCallback(
    (ed: editor.IStandaloneCodeEditor) => {
      recordEditorRef.current = ed;
      ed.updateOptions({
        fontFamily: codeFontFamily,
        fontSize: codeFontSize,
      });
      if (activeTab === 'record' && recordJson) {
        runRecordJsonFolding(ed, recordFoldMode);
      }
    },
    [activeTab, recordJson, recordFoldMode, codeFontFamily, codeFontSize],
  );

  useEffect(() => {
    if (activeTab !== 'record' || !recordJson) return;
    const ed = recordEditorRef.current;
    if (!ed) return;
    return runRecordJsonFolding(ed, recordFoldMode);
  }, [activeTab, recordJson, recordFoldMode]);

  const showValueTools = activeTab === 'value';
  const showRecordFoldToggle = activeTab === 'record' && Boolean(selectedCell?.record);

  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) => setActiveTab(v as ViewerTab)}
      className="flex size-full flex-col"
    >
      <div className="flex flex-row items-center justify-between">
        <TabsList variant="line">
          {[
            { key: 'value' as const, label: t`Value` },
            { key: 'record' as const, label: t`Record` },
            { key: 'calculate' as const, label: t`Calculate` },
          ].map(({ key, label }) => (
            <TabsTrigger
              key={key}
              value={key}
              className={cn('group-data-[orientation=horizontal]/tabs:after:bottom-px')}
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <div className="flex flex-row items-center">
          {showValueTools ? (
            <>
              <FormatTypeDropdown type={type} setType={setType} />
              <TooltipButton
                icon={<LetterTextIcon className="size-5" />}
                disabled={!type.includes('JSON')}
                onClick={handleFormat}
                tooltip={t`Format`}
              />
            </>
          ) : null}

          {showRecordFoldToggle ? (
            <TooltipButton
              icon={
                recordFoldMode === 'compact' ? (
                  <ChevronsUpDownIcon className="size-5" />
                ) : (
                  <ChevronsDownUpIcon className="size-5" />
                )
              }
              onClick={() => {
                setRecordFoldMode((m) => (m === 'compact' ? 'expanded' : 'compact'));
              }}
              tooltip={
                recordFoldMode === 'compact' ? t`Expand all` : t`Fold nested fields`
              }
            />
          ) : null}

          {direction == 'horizontal' ? (
            <TooltipButton
              icon={<PanelBottomIcon className="size-5" />}
              onClick={() => {
                setDirection();
              }}
              tooltip={t`Move to the bottom`}
            />
          ) : (
            <TooltipButton
              icon={<PanelRightIcon className="size-5" />}
              onClick={() => {
                setDirection();
              }}
              tooltip={t`Move to the top`}
            />
          )}

          <TooltipButton
            icon={<XIcon className="size-5" />}
            onClick={() => {
              setShowValue();
            }}
            tooltip={t`Close`}
          />
        </div>
      </div>
      <TabsContent value="value" className="size-full">
        {selectedCell === null ? (
          <pre className="flex size-full items-center justify-center">
            <Trans>not selected</Trans>
          </pre>
        ) : (
          <MonacoEditor
            theme={theme}
            language={type.includes('JSON') ? 'json' : 'plaintext'}
            value={value}
            onMount={(ed) => {
              valueEditorRef.current = ed;
              ed.updateOptions({
                fontFamily: codeFontFamily,
                fontSize: codeFontSize,
              });
            }}
            options={{
              ...monacoBaseOptions,
              lineNumbers: 'off',
              fontFamily: codeFontFamily,
              fontSize: codeFontSize,
            }}
          />
        )}
      </TabsContent>
      <TabsContent value="record" className="size-full min-h-0">
        {!selectedCell?.record ? (
          <pre className="flex size-full items-center justify-center">
            <Trans>not selected</Trans>
          </pre>
        ) : (
          <MonacoEditor
            theme={theme}
            language="json"
            value={recordJson}
            onMount={mountRecordEditor}
            options={{
              ...monacoBaseOptions,
              readOnly: true,
              folding: true,
              foldingHighlight: true,
              lineNumbers: 'on',
              fontFamily: codeFontFamily,
              fontSize: codeFontSize,
            }}
          />
        )}
      </TabsContent>
      <TabsContent value="calculate" className="size-full">
        <ErrorBoundary fallback={<p><Trans>Something went wrong</Trans></p>}>
          <CalcViewer cells={selectedCellInfos} />
        </ErrorBoundary>
      </TabsContent>
    </Tabs>
  );
}

function CalcViewer({ cells }: { cells?: SelectedCellType[][] | null }) {
  const { t } = useLingui();
  const data =
    cells?.map((row) => {
      return Object.fromEntries(row.map(({ field, value }) => [field, value]));
    }) ?? [];
  const df = new DataFrame(data);

  const statsArr = df.statsAll();

  const handleCopyMarkdown = async () => {
    const md = df.statsMarkdown();
    if (!md) return;
    try {
      await navigator.clipboard.writeText(md);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="flex size-full flex-col gap-1 overflow-auto">
      <div className="flex shrink-0 justify-end px-2 pt-1">
        <button
          type="button"
          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          onClick={() => {
            void handleCopyMarkdown();
          }}
        >
          {t`Copy as Markdown`}
        </button>
      </div>
      <Table className="text-xs font-mono">
        <TableHeader>
          <TableRow>
            <TableCell className="w-20 p-1 pl-4">
              <Trans>Field</Trans>
            </TableCell>
            {df.inds.map((k) => {
              return (
                <TableCell key={k} className="w-10 p-1">
                  {k.toUpperCase()}
                </TableCell>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {statsArr.map((row, i) => {
            return (
              <TableRow key={i}>
                <TableCell className="w-20 p-1 pl-4">
                  {row?.['field'] as string}
                </TableCell>
                {df.inds.map((k) => {
                  const v = row?.[k];
                  const display =
                    v == null || (typeof v === 'number' && Number.isNaN(v))
                      ? '—'
                      : String(v);
                  return (
                    <TableCell key={k} className="w-10 p-1">
                      {display}
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
