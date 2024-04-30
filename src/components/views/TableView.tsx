import MonacoEditor from '@monaco-editor/react';
import PivotTableChartIcon from '@mui/icons-material/PivotTableChart';
import { IconDecimal } from '@tabler/icons-react';
import { useAtomValue } from 'jotai';
import {
  CodeIcon,
  DownloadIcon,
  EyeIcon,
  Loader2Icon,
  RefreshCw,
} from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Stack, ToolbarContainer } from '@/components/Toolbar';
import { AgTable, CanvasTable } from '@/components/tables';
import { cn } from '@/lib/utils';
import { precisionAtom, tableRenderAtom } from '@/stores/setting';
import { TabContextType, useTabsStore } from '@/stores/tabs';

import { TooltipButton } from '@/components/custom/button';
import { Pagination } from '@/components/custom/pagination.tsx';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable.tsx';
import { usePageStore } from '@/hooks/context';
import { useTheme } from '@/hooks/theme-provider';
import { isDarkTheme } from '@/utils';

export const Loading = ({ className }: { className?: string }) => {
  return (
    <Loader2Icon
      className={cn(
        'my-28 h-16 w-full text-primary/60 animate-spin',
        className,
      )}
    />
  );
};

export function TableView({ context }: { context: TabContextType }) {
  const {
    refresh,
    loading,
    data,
    tableSchema,
    beautify,
    orderBy,
    transpose,
    showValue,
  } = usePageStore();
  const currentTab = useTabsStore((s) => s.currentId);

  useEffect(() => {
    if (currentTab == context.id) {
      (async () => {
        try {
          await refresh();
        } catch (error) {
          toast.error((error as Error).message);
        }
      })();
    }
  }, []);
  const precision = useAtomValue(precisionAtom);
  const tableRender = useAtomValue(tableRenderAtom);
  const TableComponent = tableRender === 'canvas' ? CanvasTable : AgTable;

  const [selectedCell, setSelectCell] = useState<string | null>();

  const theme = useTheme();

  return (
    <div className="h-full flex flex-col">
      <ViewToolbar />
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel defaultSize={80} className="flex flex-col size-full">
          <div className="h-full flex flex-col">
            <InputToolbar />
            <div className="h-full flex-1">
              <Suspense fallback={<Loading />}>
                {loading ? <Loading /> : null}
                <TableComponent
                  style={loading ? { display: 'none' } : undefined}
                  data={data ?? []}
                  schema={tableSchema ?? []}
                  beautify={beautify}
                  orderBy={orderBy}
                  precision={precision}
                  transpose={transpose}
                  onSelectedCell={(arg) => {
                    setSelectCell(arg as string);
                  }}
                />
              </Suspense>
            </div>
          </div>
        </ResizablePanel>
        <ResizableHandle />
        {showValue ? (
          <ResizablePanel
            defaultSize={20}
            className="flex flex-row items-start"
          >
            {selectedCell === null ? (
              <pre className="size-full flex items-center justify-center">
                not selected
              </pre>
            ) : (
              <MonacoEditor
                theme={isDarkTheme(theme) ? 'vs-dark' : 'light'}
                value={selectedCell?.toString()}
                options={{
                  minimap: {
                    enabled: false,
                  },
                  wordWrap: 'on',
                }}
              />
            )}
          </ResizablePanel>
        ) : null}
      </ResizablePanelGroup>
    </div>
  );
}

function ViewToolbar() {
  const {
    data,
    page,
    perPage,
    total,
    sql,
    elapsed,

    setShowValue,

    refresh,
    setBeautify,
    setPagination,
    setTranspose,
  } = usePageStore();

  const handeChange = (page: number, perPage: number) => {
    setPagination?.({ page, perPage });
  };

  return (
    <ToolbarContainer>
      <Stack>
        <Pagination
          current={page}
          count={data.length}
          total={total}
          pageSize={perPage}
          onChange={handeChange}
        />

        <TooltipButton
          icon={<IconDecimal className="size-5" />}
          onClick={setBeautify}
          tooltip="Float precision"
        />
        {/*<Separator orientation="vertical" />*/}

        <TooltipButton
          icon={<RefreshCw />}
          onClick={async () => {
            await refresh();
          }}
          tooltip="Refresh"
        />
        <div className="text-xs ml-6">
          elapsed time: {elapsedRender(elapsed)}
        </div>
      </Stack>
      <Stack>
        <TooltipButton
          icon={<PivotTableChartIcon fontSize="small" />}
          onClick={setTranspose}
          tooltip="Transpose"
        />
        {/* TODO */}

        <HoverCard>
          <HoverCardTrigger>
            <TooltipButton
              disabled={!sql}
              icon={<CodeIcon />}
              onClick={setTranspose}
            />
          </HoverCardTrigger>
          <HoverCardContent className="font-mono select-all">
            {sql}
          </HoverCardContent>
        </HoverCard>

        <TooltipButton
          icon={<EyeIcon />}
          onClick={setShowValue}
          tooltip="Value Viewer"
        />
        <TooltipButton
          disabled
          icon={<DownloadIcon />}
          tooltip="Export to CSV"
          onClick={() => {}}
        />
      </Stack>
    </ToolbarContainer>
  );
}

export function elapsedRender(elapsed?: number) {
  return elapsed ? `${elapsed}ms` : 'NA';
}

export function InputToolbar() {
  const { setSQLWhere, setSQLOrderBy } = usePageStore();

  const [stmt, setStmt] = useState({
    where: '',
    orderBy: '',
  });

  return (
    <div className="flex flex-row items-center h-8 min-h-8 bg-background/40 border-b font-mono">
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel defaultSize={50} className="flex flex-row items-center">
          <div className="mx-1.5 text-muted-foreground">WHERE</div>
          <input
            className="flex-1 h-full border-none p-0 outline-none bg-transparent"
            value={stmt.where}
            onKeyDown={async (e) => {
              if (e.key === 'Enter') {
                setSQLOrderBy(stmt.orderBy);
                setSQLWhere(stmt.where);
              }
            }}
            onChange={(e) => {
              setStmt((v) => ({ ...v, where: e.target.value }));
            }}
          />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={50} className="flex flex-row items-center">
          <div className="mx-1.5 text-muted-foreground">ORDER BY</div>
          <input
            className="flex-1 h-full border-none p-0 outline-none bg-transparent"
            value={stmt.orderBy}
            onKeyDown={async (e) => {
              if (e.key === 'Enter') {
                setSQLOrderBy(stmt.orderBy);
                setSQLWhere(stmt.where);
              }
            }}
            onChange={(e) => {
              setStmt((v) => ({ ...v, orderBy: e.target.value }));
            }}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
