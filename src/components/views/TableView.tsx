import MonacoEditor from '@monaco-editor/react';
import { IconDecimal } from '@tabler/icons-react';
import { useAtomValue } from 'jotai';
import {
  CodeIcon,
  CrossIcon,
  DownloadIcon,
  EyeIcon,
  Loader2Icon,
  RefreshCw,
} from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Stack, ToolbarContainer } from '@/components/Toolbar';
import { CanvasTable } from '@/components/tables';
import { cn } from '@/lib/utils';
import { precisionAtom } from '@/stores/setting';
import { TabContextType, useTabsStore } from '@/stores/tabs';

import { TransposeIcon } from '@/components/custom/Icons';
import { TooltipButton } from '@/components/custom/button';
import { Pagination } from '@/components/custom/pagination';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
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
    cross,
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
  const TableComponent = CanvasTable;

  const [selectedCell, setSelectCell] = useState<{
    value?: string;
    col: number;
    row: number;
  } | null>();

  const theme = useTheme();

  return (
    <div className="h-full flex flex-col">
      <DataViewToolbar />
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel defaultSize={80} className="flex flex-col size-full">
          <div className="h-full flex flex-col">
            <InputToolbar />
            <div className="h-full flex-1 overflow-hidden">
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
                  cross={cross}
                  onSelectedCell={(arg) => {
                    setSelectCell(arg);
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
                value={selectedCell?.value?.toString() ?? ''}
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

function DataViewToolbar() {
  const {
    data,
    page,
    perPage,
    total,
    sql,
    elapsed,
    cross,
    transpose,
    setShowValue,

    refresh,
    setBeautify,
    setPagination,
    setTranspose,
    setCross,
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
          icon={<CrossIcon />}
          onClick={setCross}
          tooltip="Cross"
          active={cross}
        />
        <TooltipButton
          icon={<TransposeIcon />}
          onClick={setTranspose}
          tooltip="Transpose"
          active={transpose}
        />
        {/* TODO */}

        <HoverCard>
          <HoverCardTrigger>
            <TooltipButton disabled={!sql} icon={<CodeIcon />} />
          </HoverCardTrigger>
          <HoverCardContent className="font-mono select-all text-xs">
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
          <div className="mx-1.5 text-muted-foreground text-sm">WHERE</div>
          <input
            className="flex-1 h-full border-none p-0 outline-none bg-transparent text-sm"
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
          <div className="mx-1.5 text-muted-foreground text-sm">ORDER BY</div>
          <input
            className="flex-1 h-full border-none p-0 outline-none bg-transparent text-sm"
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
