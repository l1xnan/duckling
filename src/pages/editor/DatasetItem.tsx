import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import KeyboardDoubleArrowLeftIcon from '@mui/icons-material/KeyboardDoubleArrowLeft';
import KeyboardDoubleArrowRightIcon from '@mui/icons-material/KeyboardDoubleArrowRight';
import SyncIcon from '@mui/icons-material/Sync';
import { Box, Divider, IconButton, Stack } from '@mui/material';
import { IconDecimal } from '@tabler/icons-react';
import { PrimitiveAtom, useAtom, useAtomValue, useSetAtom } from 'jotai';
import { focusAtom } from 'jotai-optics';
import { Suspense, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { AgTable } from '@/components/AgTable';
import { Loading } from '@/components/Dataset';
import { TablerSvgIcon } from '@/components/MuiIconButton';
import { PaginationDropdown } from '@/components/PaginationDropdown';
import { ToolbarContainer } from '@/components/Toolbar';
import { QueryContextType, execute } from '@/stores/tabs';
import { isDarkTheme } from '@/utils';

export interface DatasetProps {
  tableName: string;
}

export function DatasetItem({
  context,
}: {
  context: PrimitiveAtom<QueryContextType>;
}) {
  const [ctx, setContext] = useAtom(context);
  const [loading, setLoading] = useState(false);

  const handleQuery = async () => {
    try {
      setLoading(true);
      const res = (await execute(ctx)) ?? {};
      setContext((prev) => ({ ...prev, ...res }));
    } catch (error) {
      console.error(error);
      toast.warning((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await handleQuery();
    })();
  }, []);

  return (
    <Stack height={'100%'}>
      <PageSizeToolbar query={handleQuery} ctx={context} />
      <Box sx={{ height: '100%' }}>
        <Suspense fallback={<Loading />}>
          {loading ? <Loading /> : null}
          <AgTable
            style={loading ? { display: 'none' } : undefined}
            data={ctx.data ?? []}
            schema={ctx.schema ?? []}
            beautify={ctx.beautify}
            orderBy={ctx.orderBy}
          />
        </Suspense>
      </Box>
    </Stack>
  );
}

interface PageSizeToolbarProps {
  query: () => Promise<void>;
  ctx: PrimitiveAtom<QueryContextType>;
}

function PageSizeToolbar({ query, ctx }: PageSizeToolbarProps) {
  const context = useAtomValue(ctx);

  const { page, perPage, totalCount, data } = context;

  const pageAtom = focusAtom(ctx, (o) => o.prop('page'));
  const perPageAtom = focusAtom(ctx, (o) => o.prop('perPage'));
  const beautifyAtom = focusAtom(ctx, (o) => o.prop('beautify'));
  const setPage = useSetAtom(pageAtom);
  const setPerPage = useSetAtom(perPageAtom);
  const setBeautify = useSetAtom(beautifyAtom);

  const handleBeautify = () => {
    setBeautify((prev) => !prev);
  };
  const handleRefresh = async () => {
    await query();
  };

  const toFirst = async () => {
    setPage(1);
    await query();
  };
  const toLast = async () => {
    setPage(Math.ceil(context.totalCount / context.perPage));
    await query();
  };

  const increase = async () => {
    setPage((prev) => prev + 1);
    await query();
  };

  const decrease = async () => {
    setPage((prev) => prev - 1);
    await query();
  };

  const handlePerPage = async (page: number) => {
    setPerPage(() => page);
    await query();
  };

  const count = data?.length ?? 0;
  const start = perPage * (page - 1) + 1;
  const end = start + count - 1;
  const content = count >= totalCount ? `${count} rows` : `${start}-${end}`;

  return (
    <ToolbarContainer>
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={(theme) => ({
          backgroundColor: isDarkTheme(theme) ? '#2b2d30' : '#f7f8fa',
          height: 32,
          '& MuiSvgIcon-root': {
            fontSize: 16,
          },
        })}
      >
        <IconButton color="inherit" onClick={toFirst} disabled={page <= 1}>
          <KeyboardDoubleArrowLeftIcon />
        </IconButton>
        <IconButton color="inherit" onClick={decrease} disabled={page <= 1}>
          <KeyboardArrowLeftIcon />
        </IconButton>
        <PaginationDropdown content={content} setPerPage={handlePerPage} />
        {count < totalCount ? `of ${totalCount}` : null}
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
        <IconButton color="inherit" onClick={handleBeautify}>
          <TablerSvgIcon icon={<IconDecimal />} />
        </IconButton>
        <Divider orientation="vertical" flexItem />
        <IconButton color="inherit" onClick={handleRefresh}>
          <SyncIcon fontSize="small" />
        </IconButton>
      </Stack>
    </ToolbarContainer>
  );
}

export default DatasetItem;
