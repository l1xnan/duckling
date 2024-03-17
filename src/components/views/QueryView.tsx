import { IconButton } from '@mui/material';
import { IconDecimal } from '@tabler/icons-react';
import * as dialog from '@tauri-apps/plugin-dialog';
import { PrimitiveAtom, useAtom, useAtomValue, useSetAtom } from 'jotai';
import { focusAtom } from 'jotai-optics';

import { ArrowDownToLineIcon, RefreshCwIcon } from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { TablerSvgIcon } from '@/components/MuiIconButton';
import { Stack, ToolbarContainer } from '@/components/Toolbar';
import { Pagination } from '@/components/custom/pagination';
import { AgTable } from '@/components/tables/AgTable';
import { CanvasTable } from '@/components/tables/CanvasTable';
import { Separator } from '@/components/ui/separator';
import { Loading } from '@/components/views/TableView';
import { atomStore } from '@/stores';
import { precisionAtom, tableRenderAtom } from '@/stores/setting';
import { QueryContextType, executeSQL, exportData } from '@/stores/tabs';
import PivotTableChartIcon from '@mui/icons-material/PivotTableChart';

export function QueryView({
  context,
}: {
  context: PrimitiveAtom<QueryContextType>;
}) {
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
  return (
    <div className="h-full flex flex-col">
      <PageSizeToolbar
        query={handleQuery}
        exportData={handleExport}
        ctx={context}
      />
      <div className="h-full flex-1">
        <Suspense fallback={<Loading />}>
          {loading ? <Loading /> : null}
          <TableComponent
            style={loading ? { display: 'none' } : undefined}
            data={ctx.data ?? []}
            schema={ctx.tableSchema ?? []}
            precision={precision}
            beautify={ctx.beautify}
            transpose={ctx.transpose}
          />
        </Suspense>
      </div>
    </div>
  );
}

interface PageSizeToolbarProps {
  query: (ctx?: QueryContextType) => Promise<void>;
  exportData: (file: string) => Promise<void>;
  ctx: PrimitiveAtom<QueryContextType>;
}

function PageSizeToolbar({ query, ctx, exportData }: PageSizeToolbarProps) {
  const context = useAtomValue(ctx);

  const { page, perPage, totalCount, data } = context;

  const pageAtom = focusAtom(ctx, (o) => o.prop('page'));
  const perPageAtom = focusAtom(ctx, (o) => o.prop('perPage'));
  const beautifyAtom = focusAtom(ctx, (o) => o.prop('beautify'));
  const transposeAtom = focusAtom(ctx, (o) => o.prop('transpose'));
  const setPage = useSetAtom(pageAtom);
  const setPerPage = useSetAtom(perPageAtom);
  const setBeautify = useSetAtom(beautifyAtom);
  const setTranspose = useSetAtom(transposeAtom);

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
          total={totalCount}
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
      </Stack>
      <Stack>
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

export default QueryView;
