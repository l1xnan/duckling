import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import KeyboardDoubleArrowLeftIcon from '@mui/icons-material/KeyboardDoubleArrowLeft';
import KeyboardDoubleArrowRightIcon from '@mui/icons-material/KeyboardDoubleArrowRight';
import SyncIcon from '@mui/icons-material/Sync';
import {
  Box,
  CircularProgress,
  Divider,
  IconButton,
  Snackbar,
  Stack,
} from '@mui/material';
import { IconDecimal } from '@tabler/icons-react';
import { PrimitiveAtom, useAtom, useAtomValue, useSetAtom } from 'jotai';
import { focusAtom } from 'jotai-optics';
import React, {
  ReactNode,
  Suspense,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import { AgTable } from '@/components/AgTable';
import Dropdown from '@/components/Dropdown';
import { TablerSvgIcon } from '@/components/MuiIconButton';
import { ToolbarContainer } from '@/components/Toolbar';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/components/ui/use-toast';
import { PageContext, createDatasetStore } from '@/stores/dataset';
import { QueryContextType, TabContextType, execute } from '@/stores/tabs';
import { isDarkTheme } from '@/utils';

export interface DatasetProps {
  tableName: string;
}

export const PageProvider = ({
  table,
  children,
}: {
  table: TabContextType;
  children: ReactNode;
}) => {
  const storeRef = useRef(createDatasetStore(table));
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

export function DatasetItem({
  context,
}: {
  context: PrimitiveAtom<QueryContextType>;
}) {
  const [ctx, setContext] = useAtom(context);
  const { toast } = useToast();

  const handleQuery = async () => {
    try {
      const res = (await execute(ctx)) ?? {};
      setContext((prev) => ({ ...prev, ...res }));
    } catch (error) {
      console.log(error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: (error as Error).message,
        duration: 3000,
      });
    }
  };

  useEffect(() => {
    (async () => {
      await handleQuery();
    })();
  }, []);

  const [open, setOpen] = useState(false);

  const handleClose = (
    _event: React.SyntheticEvent | Event,
    reason?: string,
  ) => {
    if (reason === 'clickaway') {
      return;
    }

    setOpen(false);
  };

  return (
    <Stack height={'100%'}>
      <Toaster />
      <PageSizeToolbar query={handleQuery} ctx={context} />
      <Box sx={{ height: '100%' }}>
        <Suspense
          fallback={
            <Box
              sx={{
                display: 'flex',
                height: 'calc(100vh - 64px)',
                width: '100%',
                marginTop: '30%',
                justifyContent: 'center',
              }}
            >
              <CircularProgress />
            </Box>
          }
        >
          <AgTable
            data={ctx.data ?? []}
            schema={ctx.schema ?? []}
            beautify={ctx?.beautify}
          />
        </Suspense>
      </Box>

      {ctx?.message?.length ?? 0 > 0 ? (
        <Snackbar
          open={open}
          autoHideDuration={3000}
          onClose={handleClose}
          message={ctx?.message ?? ''}
        />
      ) : null}
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
  const beautifyAtom = focusAtom(ctx, (o) => o.prop('beautify'));
  const setPage = useSetAtom(pageAtom);
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
        <Dropdown content={content} />
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
