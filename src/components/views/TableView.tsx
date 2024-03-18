import PivotTableChartIcon from '@mui/icons-material/PivotTableChart';
import SyncIcon from '@mui/icons-material/Sync';
import { IconButton } from '@mui/material';
import { IconDecimal } from '@tabler/icons-react';
import { useAtomValue } from 'jotai';
import { CodeIcon, DownloadIcon, Loader2Icon } from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Stack, ToolbarContainer } from '@/components/Toolbar';
import { AgTable, CanvasTable } from '@/components/tables';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { precisionAtom, tableRenderAtom } from '@/stores/setting';
import { TabContextType, activeTabAtom } from '@/stores/tabs';

import { Pagination } from '@/components/custom/pagination.tsx';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { usePageStore } from '@/hooks/context';
import { TablerSvgIcon } from '../MuiIconButton';

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
  const { refresh, loading, data, tableSchema, beautify, orderBy, transpose } =
    usePageStore();
  const currentTab = useAtomValue(activeTabAtom);

  useEffect(() => {
    if (currentTab?.id == context.id) {
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

  return (
    <div className="h-full flex flex-col">
      <PageSizeToolbar />
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
          />
        </Suspense>
      </div>
    </div>
  );
}

function PageSizeToolbar() {
  const {
    data,
    page,
    perPage,
    total,
    sql,

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
        <IconButton color="inherit" onClick={setBeautify}>
          <TablerSvgIcon icon={<IconDecimal />} />
        </IconButton>
        <Separator orientation="vertical" />
        <IconButton
          color="inherit"
          onClick={async () => {
            await refresh();
          }}
        >
          <SyncIcon fontSize="small" />
        </IconButton>
      </Stack>
      <Stack>
        <IconButton color="inherit" onClick={setTranspose}>
          <PivotTableChartIcon fontSize="small" />
        </IconButton>
        {/* TODO */}

        <HoverCard>
          <HoverCardTrigger>
            <IconButton disabled={!sql} color="inherit" onClick={() => {}}>
              <CodeIcon size={16} />
            </IconButton>
          </HoverCardTrigger>
          <HoverCardContent className="font-mono select-all">
            {sql}
          </HoverCardContent>
        </HoverCard>

        <IconButton disabled color="inherit" onClick={() => {}}>
          <DownloadIcon size={16} />
        </IconButton>
      </Stack>
    </ToolbarContainer>
  );
}

export function InputToolbar() {
  const { setSQLWhere, setSQLOrderBy } = usePageStore();

  const [stmt, setStmt] = useState({
    where: '',
    orderBy: '',
  });

  return (
    <div className="flex flex-row items-center h-8 min-h-8 bg-background/40 border-b font-mono">
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
      <Separator orientation="vertical" />
      <div className="mx-1.5 text-muted-foreground">ORDER BY</div>
      <input
        className="flex-[2_2_0%] h-full border-none p-0 outline-none bg-transparent"
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
    </div>
  );
}
