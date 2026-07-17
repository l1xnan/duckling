import { Data, Vector } from '@apache-arrow/ts';
import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import MonacoEditor from '@monaco-editor/react';
import { useAtomValue } from 'jotai';
import { LetterTextIcon, PanelBottomIcon, PanelRightIcon, XIcon } from 'lucide-react';
import { editor } from 'monaco-editor';
import { useEffect, useRef, useState } from 'react';

import { arrowToJSON } from '@/api';
import { TooltipButton } from '@/components/custom/button';
import { DropdownMenu, DropdownMenuItem } from '@/components/custom/dropdown-menu';
import ErrorBoundary from '@/components/ErrorBoundary';
import { DropdownMenuContent } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { Direction } from '@/stores/dataset';
import { codeFontFamilyAtom, codeFontSizeAtom, useEditorTheme } from '@/stores/setting';
import { DataFrame } from '@/utils/dataframe';

import { SelectedCellType } from './TableView';

const FORMAT_OPTIONS: { value: string; label: MessageDescriptor | string }[] = [
  { value: 'Raw', label: msg`Raw` },
  { value: 'JSON', label: 'JSON' },
  { value: 'Raw(JSON)', label: msg`Raw(JSON)` },
];

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

export function ValueViewer({
  selectedCell,
  selectedCellInfos,
  setShowValue,
  setDirection,
  direction,
}: ValueViewerProps) {
  const { t } = useLingui();
  const theme = useEditorTheme();
  const codeFontFamily = useAtomValue(codeFontFamilyAtom);
  const codeFontSize = useAtomValue(codeFontSizeAtom);

  const [type, setType] = useState('Raw');
  const editorRef = useRef<editor.IStandaloneCodeEditor>(null);

  useEffect(() => {
    editorRef.current?.updateOptions({
      fontFamily: codeFontFamily,
      fontSize: codeFontSize,
    });
  }, [codeFontFamily, codeFontSize]);

  const handleFormat = () => {
    if (!editorRef.current) return;

    try {
      // 触发 Monaco 内置的格式化命令
      editorRef.current?.getAction('editor.action.formatDocument')?.run();
    } catch (error) {
      console.error('格式化失败:', error);
    }
  };
  
  console.log(selectedCell, selectedCellInfos);
  const value = displayValue(selectedCell?.value as Data, type);
  return (
    <Tabs defaultValue="value" className="size-full flex flex-col">
      <div className="flex flex-row items-center justify-between">
        <TabsList variant="line">
          {[
            { key: 'value', label: t`Value` },
            { key: 'calculate', label: t`Calculate` },
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
          <FormatTypeDropdown type={type} setType={setType} />
          <TooltipButton
            icon={<LetterTextIcon className="size-5" />}
            disabled={!type.includes('JSON')}
            onClick={handleFormat}
            tooltip={t`Format`}
          />

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
          <pre className="size-full flex items-center justify-center">
            <Trans>not selected</Trans>
          </pre>
        ) : (
          <MonacoEditor
            theme={theme}
            language={type.includes('JSON') ? 'json' : 'plaintext'}
            value={value}
            onMount={(editor) => {
              editorRef.current = editor;
              editor.updateOptions({
                fontFamily: codeFontFamily,
                fontSize: codeFontSize,
              });
            }}
            options={{
              minimap: {
                enabled: false,
              },
              lineNumbers: 'off',
              wordWrap: 'on',
              tabSize: 2,
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
  const data =
    cells?.map((row) => {
      return Object.fromEntries(row.map(({ field, value }) => [field, value]));
    }) ?? [];
  const df = new DataFrame(data);

  console.log(data);

  const statsArr = df.statsAll();
  return (
    <Table className="text-xs font-mono">
      <TableHeader>
        <TableRow>
          <TableCell className="p-1 w-20 pl-4">
            <Trans>Field</Trans>
          </TableCell>
          {df.inds.map((k) => {
            return (
              <TableCell key={k} className="p-1 w-10">
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
              <TableCell className="p-1 w-20 pl-4">{row?.['field'] as string}</TableCell>
              {df.inds.map((k) => {
                return (
                  <TableCell key={k} className="p-1 w-10">
                    {row?.[k] as string}
                  </TableCell>
                );
              })}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
