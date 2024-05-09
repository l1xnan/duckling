import MonacoEditor from '@monaco-editor/react';

import { IconDecimal } from '@tabler/icons-react';
import * as dialog from '@tauri-apps/plugin-dialog';
import { PrimitiveAtom, useAtom, useAtomValue } from 'jotai';
import { CodeIcon, DownloadIcon, EyeIcon, RefreshCw } from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';

import { Stack, ToolbarContainer } from '@/components/Toolbar';
import { TransposeIcon } from '@/components/custom/Icons';
import { Pagination } from '@/components/custom/pagination';
import { AgTable } from '@/components/tables/AgTable';
import { CanvasTable } from '@/components/tables/CanvasTable';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { Separator } from '@/components/ui/separator';
import { Loading } from '@/components/views/TableView';
import { useTheme } from '@/hooks/theme-provider';
import { atomStore } from '@/stores';
import { precisionAtom, tableRenderAtom } from '@/stores/setting';
import { QueryContextType, executeSQL, exportData } from '@/stores/tabs';
import { isDarkTheme } from '@/utils';

import { TooltipButton } from '@/components/custom/button';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { useFocusAtom } from '@/hooks';

type QueryContextAtom = PrimitiveAtom<QueryContextType>;

export function QueryView({ context }: { context: QueryContextAtom }) {
  const [ctx, setContext] = useAtom(context);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleQuery = async (ctx?: QueryContextType) => {
    try {
      setLoading(true);
      if (!ctx) {
        ctx = atomStore.get(context);
      }
      const res = await executeSQL(ctx);
      setContext((prev) => ({ ...prev, ...res }));
      if (res?.message) {
        setError(res?.message);
      }
    } catch (error) {
      console.error(error);
      setError(error as string);
    } finally {
      setLoading(false);
    }
  };
  const handleExport = async (file: string) => {
    try {
      const ctx = atomStore.get(context);
      await exportData({ file }, ctx);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    (async () => {
      await handleQuery(ctx);
    })();
  }, []);

  const precision = useAtomValue(precisionAtom);
  const tableRender = useAtomValue(tableRenderAtom);

  const TableComponent = tableRender === 'canvas' ? CanvasTable : AgTable;
  const [selectedCell, setSelectCell] = useState<string | null>(null);

  const theme = useTheme();

  return (
    <div className="h-full flex flex-col">
      <PageSizeToolbar
        query={handleQuery}
        exportData={handleExport}
        ctx={context}
      />

      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel defaultSize={80}>
          <Suspense fallback={<Loading />}>
            {loading ? <Loading /> : null}
            {!ctx.data?.length && error ? (
              <div className="font-mono text-sm select-text">{error}</div>
            ) : null}
            <TableComponent
              style={
                loading || (!ctx.data?.length && error)
                  ? { display: 'none' }
                  : undefined
              }
              data={ctx.data ?? []}
              schema={ctx.tableSchema ?? []}
              precision={precision}
              beautify={ctx.beautify}
              transpose={ctx.transpose}
              onSelectedCell={(arg) => {
                setSelectCell(arg as string);
                console.log(arg);
              }}
            />
          </Suspense>
        </ResizablePanel>
        <ResizableHandle />
        {ctx.showValue ? (
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

interface PageSizeToolbarProps {
  query: (ctx?: QueryContextType) => Promise<void>;
  exportData: (file: string) => Promise<void>;
  ctx: QueryContextAtom;
}

function PageSizeToolbar({ query, ctx, exportData }: PageSizeToolbarProps) {
  const setPage = useFocusAtom(ctx, 'page');
  const setPerPage = useFocusAtom(ctx, 'perPage');
  const setTranspose = useFocusAtom(ctx, 'transpose');
  const setBeautify = useFocusAtom(ctx, 'beautify');
  const setShowValue = useFocusAtom(ctx, 'showValue');

  const context = useAtomValue(ctx);
  const { page, perPage, total, data } = context;

  const handleBeautify = () => {
    setBeautify((prev) => !prev);
  };

  const handleRefresh = async () => {
    await query(context);
  };

  const handeChange = async (page: number, perPage: number) => {
    setPage(page);
    setPerPage(perPage);
    await query();
  };
  const handleTranspose = () => {
    setTranspose((v) => !v);
  };

  const count = data?.length ?? 0;
  const handleExport = async () => {
    const file = await dialog.save({
      title: 'Export',
      defaultPath: `xxx-${new Date().getTime()}.csv`,
      filters: [{ name: 'CSV', extensions: ['csv'] }],
    });
    if (file) {
      exportData(file);
    }
  };
  return (
    <ToolbarContainer>
      <Stack>
        <Pagination
          current={page}
          count={count}
          total={total}
          pageSize={perPage}
          onChange={handeChange}
        />
        <TooltipButton
          icon={<IconDecimal className="size-5" />}
          onClick={handleBeautify}
          tooltip="Float precision"
        />
        <Separator orientation="vertical" />
        <TooltipButton
          icon={<RefreshCw />}
          onClick={handleRefresh}
          tooltip="Refresh"
        />
        <div className="text-xs ml-6">elapsed time: {context.elapsed}ms</div>
      </Stack>
      <Stack>
        <TooltipButton
          icon={<EyeIcon />}
          onClick={() => {
            setShowValue((prev) => !prev);
          }}
          tooltip="Value Viewer"
        />
        <HoverCard>
          <HoverCardTrigger>
            <TooltipButton disabled={!context.sql} icon={<CodeIcon />} />
          </HoverCardTrigger>
          <HoverCardContent className="font-mono select-all">
            {context.sql}
          </HoverCardContent>
        </HoverCard>

        <TooltipButton
          disabled
          icon={<DownloadIcon />}
          tooltip="Export to CSV"
          onClick={handleExport}
        />

        <TooltipButton
          icon={<TransposeIcon fontSize="small" />}
          onClick={handleTranspose}
          tooltip="Transpose"
        />
      </Stack>
    </ToolbarContainer>
  );
}
