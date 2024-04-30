import MonacoEditor from '@monaco-editor/react';
import { IconButton } from '@mui/material';

import { IconDecimal } from '@tabler/icons-react';
import * as dialog from '@tauri-apps/plugin-dialog';
import { PrimitiveAtom, useAtom, useAtomValue, useSetAtom } from 'jotai';
import { focusAtom } from 'jotai-optics';
import {
  ArrowDownToLineIcon,
  CodeIcon,
  EyeIcon,
  RefreshCwIcon,
} from 'lucide-react';
import * as O from 'optics-ts';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { TablerSvgIcon } from '@/components/MuiIconButton';
import { Stack, ToolbarContainer } from '@/components/Toolbar';
import { Pagination } from '@/components/custom/pagination';
import { AgTable } from '@/components/tables/AgTable';
import { CanvasTable } from '@/components/tables/CanvasTable';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card.tsx';
import { Separator } from '@/components/ui/separator';
import { Loading } from '@/components/views/TableView';
import { useTheme } from '@/hooks/theme-provider';
import { atomStore } from '@/stores';
import { precisionAtom, tableRenderAtom } from '@/stores/setting';
import { QueryContextType, executeSQL, exportData } from '@/stores/tabs';
import { isDarkTheme } from '@/utils';
import PivotTableChartIcon from '@mui/icons-material/PivotTableChart';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '../ui/resizable';

type QueryContextAtom = PrimitiveAtom<QueryContextType>;

export function QueryView({ context }: { context: QueryContextAtom }) {
  const [ctx, setContext] = useAtom(context);
  const [loading, setLoading] = useState(false);

  const handleQuery = async (ctx?: QueryContextType) => {
    try {
      setLoading(true);
      if (!ctx) {
        ctx = atomStore.get(context);
      }
      const res = (await executeSQL(ctx)) ?? {};
      setContext((prev) => ({ ...prev, ...res }));
    } catch (error) {
      console.error(error);
      toast.warning((error as Error).message);
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
            <TableComponent
              style={loading ? { display: 'none' } : undefined}
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

function useFocusAtom<T, K extends keyof T>(anAtom: PrimitiveAtom<T>, key: K) {
  return useSetAtom(
    focusAtom(
      anAtom,
      useCallback((optic: O.OpticFor_<T>) => optic.prop(key), []),
    ),
  );
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
        <IconButton color="inherit" onClick={handleBeautify}>
          <TablerSvgIcon icon={<IconDecimal />} />
        </IconButton>

        <Separator orientation="vertical" />
        <IconButton color="inherit" onClick={handleRefresh}>
          <RefreshCwIcon size={16} />
        </IconButton>

        <div className="text-xs ml-6">elapsed time: {context.elapsed}ms</div>
      </Stack>
      <Stack>
        <IconButton
          color="inherit"
          // disabled
          onClick={() => {
            setShowValue((prev) => !prev);
          }}
        >
          <EyeIcon size={16} />
        </IconButton>
        <HoverCard>
          <HoverCardTrigger>
            <IconButton
              disabled={!context.sql}
              color="inherit"
              onClick={() => {}}
            >
              <CodeIcon size={16} />
            </IconButton>
          </HoverCardTrigger>
          <HoverCardContent className="font-mono select-all">
            {context.sql}
          </HoverCardContent>
        </HoverCard>
        <IconButton color="inherit" onClick={handleExport}>
          <ArrowDownToLineIcon size={16} />
        </IconButton>
        <IconButton color="inherit" onClick={handleTranspose}>
          <PivotTableChartIcon fontSize="small" />
        </IconButton>
      </Stack>
    </ToolbarContainer>
  );
}
