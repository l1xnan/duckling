import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import KeyboardDoubleArrowLeftIcon from '@mui/icons-material/KeyboardDoubleArrowLeft';
import KeyboardDoubleArrowRightIcon from '@mui/icons-material/KeyboardDoubleArrowRight';
import PivotTableChartIcon from '@mui/icons-material/PivotTableChart';
import SyncIcon from '@mui/icons-material/Sync';
import { Divider, IconButton } from '@mui/material';
import { IconDecimal } from '@tabler/icons-react';
import { useAtomValue } from 'jotai';
import { Loader2Icon } from 'lucide-react';
import {
  ReactNode,
  Suspense,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { toast } from 'sonner';

import { AgTable } from '@/components/AgTable.tsx';
import { PaginationDropdown } from '@/components/PaginationDropdown';
import { Separator } from '@/components/ui/separator.tsx';
import { cn } from '@/lib/utils';
import {
  PageContext,
  createDatasetStore,
  usePageStore,
} from '@/stores/dataset';
import { precisionAtom, tableRenderAtom } from '@/stores/setting';
import { TabContextType, activeTabAtom } from '@/stores/tabs';

import { CanvasTable } from './CanvasTable';
import { TablerSvgIcon } from './MuiIconButton';
import { Stack, ToolbarContainer } from './Toolbar';

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

export const PageProvider = ({
  context,
  children,
}: {
  context: TabContextType;
  children: ReactNode;
}) => {
  const storeRef = useRef(createDatasetStore(context));
  return (
    <PageContext.Provider value={storeRef.current}>
      {children}
    </PageContext.Provider>
  );
};

export const usePageStoreApi = () => {
  const store = useContext(PageContext);
  if (store === null) {
    throw new Error('no provider');
  }
  return store;
};

export function Dataset({ context }: { context: TabContextType }) {
  const { refresh, data, schema, beautify, orderBy, transpose } =
    usePageStore();
  const currentTab = useAtomValue(activeTabAtom);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentTab?.id == context.id) {
      (async () => {
        try {
          setLoading(true);
          await refresh();
        } catch (error) {
          toast.error((error as Error).message);
        } finally {
          setLoading(false);
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
            schema={schema ?? []}
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
    refresh,
    data,
    page,
    totalCount,
    setBeautify,
    increase,
    decrease,
    toFirst,
    toLast,
    perPage,
    setPerPage,
    setTranspose,
  } = usePageStore();

  const count = data.length;
  const start = perPage * (page - 1) + 1;
  const end = start + count - 1;
  const content = count >= totalCount ? `${count} rows` : `${start}-${end}`;
  const handlePerPage = (page: number) => {
    setPerPage?.(page);
  };

  return (
    <ToolbarContainer>
      <Stack>
        <IconButton color="inherit" onClick={toFirst} disabled={page <= 1}>
          <KeyboardDoubleArrowLeftIcon />
        </IconButton>
        <IconButton color="inherit" onClick={decrease} disabled={page <= 1}>
          <KeyboardArrowLeftIcon />
        </IconButton>
        <PaginationDropdown content={content} setPerPage={handlePerPage} />
        {count < totalCount ? `/ ${totalCount}` : null}
        <IconButton
          color="inherit"
          onClick={increase}
          disabled={page >= Math.ceil(totalCount / perPage)}
        >
          <KeyboardArrowRightIcon />
        </IconButton>
        <IconButton
          color="inherit"
          onClick={toLast}
          disabled={page >= Math.ceil(totalCount / perPage)}
        >
          <KeyboardDoubleArrowRightIcon />
        </IconButton>
        <IconButton color="inherit" onClick={setBeautify}>
          <TablerSvgIcon icon={<IconDecimal />} />
        </IconButton>
        <Divider orientation="vertical" flexItem />
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
  // orderBy ? convertOrderBy(orderBy) : '',
  // useEffect(() => {
  //   setStmtOrder(orderBy ? convertOrderBy(orderBy) : '');
  // }, [orderBy]);

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

export default Dataset;
