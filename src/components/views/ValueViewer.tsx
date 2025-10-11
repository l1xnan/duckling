import { DataFrame } from '@/utils/dataframe';
import MonacoEditor from '@monaco-editor/react';

import {
  LetterTextIcon,
  PanelBottomIcon,
  PanelRightIcon,
  XIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';

import { arrowToJSON } from '@/api';
import { TooltipButton } from '@/components/custom/button';
import {
  DropdownMenu,
  DropdownMenuItem,
} from '@/components/custom/dropdown-menu';
import ErrorBoundary from '@/components/ErrorBoundary';
import { DropdownMenuContent } from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsTrigger } from '@/components/ui/tabs';
import { Direction } from '@/stores/dataset';
import { useEditorTheme } from '@/stores/setting';
import { Data, Vector } from '@apache-arrow/ts';
import { TabsList } from '@radix-ui/react-tabs';
import { editor } from 'monaco-editor';
import { useRef, useState } from 'react';
import { SelectedCellType } from './TableView';

interface FormatTypeDropdownProps {
  type: string;
  setType: (type: string) => void;
}

export function FormatTypeDropdown({ type, setType }: FormatTypeDropdownProps) {
  return (
    <DropdownMenu content={type}>
      <DropdownMenuContent className="w-32">
        {['Raw', 'JSON'].map((item) => (
          <DropdownMenuItem
            key={item}
            onSelect={() => {
              setType(item);
            }}
          >
            {item}
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
  const theme = useEditorTheme();

  const [type, setType] = useState('Raw');
  const editorRef = useRef<editor.IStandaloneCodeEditor>(null);

  const handleFormat = () => {
    if (!editorRef.current) return;

    try {
      // 触发 Monaco 内置的格式化命令
      editorRef.current?.getAction('editor.action.formatDocument')?.run();
    } catch (error) {
      console.error('格式化失败:', error);
    }
  };

  const value = displayValue(selectedCell?.value as Data, type);
  return (
    <Tabs defaultValue="value" className="size-full">
      <div className="flex flex-row items-center justify-between">
        <TabsList>
          {[
            { key: 'value', label: 'Value' },
            { key: 'calculate', label: 'Calculate' },
          ].map(({ key, label }) => (
            <TabsTrigger
              key={key}
              value={key}
              className={cn(
                'h-8 text-xs relative wm-200 pl-3 pr-1.5 rounded-none border-r',
                'group',
                'data-[state=active]:bg-muted',
                'data-[state=active]:text-foreground',
                'data-[state=active]:shadow-none',
                'data-[state=active]:rounded-none',
              )}
            >
              {label}
              <div
                className={cn(
                  'h-0.5 w-full bg-[#1976d2] absolute left-0 invisible z-6',
                  'group-data-[state=active]:visible',
                  'bottom-0',
                )}
              />
            </TabsTrigger>
          ))}
        </TabsList>
        <div className="flex flex-row items-center">
          <FormatTypeDropdown type={type} setType={setType} />
          <TooltipButton
            icon={<LetterTextIcon className="size-5" />}
            disabled={type !== 'JSON'}
            onClick={handleFormat}
            tooltip="Format"
          />

          {direction == 'horizontal' ? (
            <TooltipButton
              icon={<PanelBottomIcon className="size-5" />}
              onClick={() => {
                setDirection();
              }}
              tooltip="Move to the bottom"
            />
          ) : (
            <TooltipButton
              icon={<PanelRightIcon className="size-5" />}
              onClick={() => {
                setDirection();
              }}
              tooltip="Move to the top"
            />
          )}

          <TooltipButton
            icon={<XIcon className="size-5" />}
            onClick={() => {
              setShowValue();
            }}
            tooltip="Close"
          />
        </div>
      </div>
      <TabsContent value="value" className="size-full">
        {selectedCell === null ? (
          <pre className="size-full flex items-center justify-center">
            not selected
          </pre>
        ) : (
          <MonacoEditor
            theme={theme}
            language={type === 'JSON' ? 'json' : 'plaintext'}
            value={value}
            onMount={(editor) => {
              editorRef.current = editor;
            }}
            options={{
              minimap: {
                enabled: false,
              },
              lineNumbers: 'off',
              wordWrap: 'on',
              tabSize: 2,
            }}
          />
        )}
      </TabsContent>
      <TabsContent value="calculate" className="size-full">
        <ErrorBoundary fallback={<p>Something went wrong</p>}>
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
          <TableCell className="p-1 w-20 pl-4">Field</TableCell>
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
              <TableCell className="p-1 w-20 pl-4">
                {row?.['field'] as string}
              </TableCell>
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
