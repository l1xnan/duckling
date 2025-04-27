import { DataFrame } from '@/utils/dataframe';
import MonacoEditor from '@monaco-editor/react';

import {
    LetterTextIcon,
    PanelBottomIcon,
    PanelRightIcon,
    XIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';

import { TooltipButton } from '@/components/custom/button';
import { useTheme } from '@/hooks/theme-provider';
import { Direction } from '@/stores/dataset';
import { isDarkTheme } from '@/utils';
import { TabsList } from '@radix-ui/react-tabs';
import ErrorBoundary from '../ErrorBoundary';
import {
    Table,
    TableBody,
    TableCell,
    TableHeader,
    TableRow,
} from '../ui/table';
import { Tabs, TabsContent, TabsTrigger } from '../ui/tabs';
import { SelectedCellType } from './TableView';

export function ValueViewer({
  selectedCell,
  selectedCellInfos,
  setShowValue,
  setDirection,
  direction,
}: {
  selectedCell?: SelectedCellType | null;
  selectedCellInfos?: SelectedCellType[][] | null;
  setShowValue: () => void;
  setDirection: () => void;
  direction: Direction;
}) {
  const theme = useTheme();

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
          <TooltipButton
            icon={<LetterTextIcon className="size-5" />}
            onClick={() => {}}
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
            theme={isDarkTheme(theme) ? 'vs-dark' : 'light'}
            value={selectedCell?.value?.toString() ?? ''}
            options={{
              minimap: {
                enabled: false,
              },
              lineNumbers: 'off',
              wordWrap: 'on',
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
