import { IconDecimal } from '@tabler/icons-react';
import * as dialog from '@tauri-apps/plugin-dialog';

import {
  CodeIcon,
  CrossIcon,
  DownloadIcon,
  EyeIcon,
  RefreshCw,
} from 'lucide-react';

import { Stack, ToolbarContainer } from '@/components/Toolbar';

import { exportCsv } from '@/api';
import { TransposeIcon } from '@/components/custom/Icons';
import { TooltipButton } from '@/components/custom/button';
import { Pagination } from '@/components/custom/pagination';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { toast } from 'sonner';

export interface DataViewToolbarProps {
  dbId: string;
  length: number;
  page: number;
  perPage: number;
  total: number;
  sql?: string;
  elapsed?: number;
  cross?: boolean;
  transpose?: boolean;
  setShowValue: () => void;
  refresh: () => void;
  setBeautify: () => void;
  setPagination?: (p: { page?: number; perPage?: number }) => void;
  setTranspose?: () => void;
  setCross?: () => void;
}

export function elapsedRender(elapsed?: number) {
  return elapsed ? `${elapsed}ms` : 'NA';
}

export function DataViewToolbar({
  dbId,
  length,
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
}: DataViewToolbarProps) {
  const handleExport = async () => {
    const file = await dialog.save({
      title: 'Export',
      defaultPath: `xxx-${new Date().getTime()}.csv`,
      filters: [{ name: 'CSV', extensions: ['csv'] }, { name: 'Parquet', extensions: ['parquet'] }, {
        name: 'XLSX',
        extensions: ['xlsx'],
      }],
    });
    if (file && sql) {
      await exportCsv({ file, dbId, sql });
      toast.success('success!');
    }
  };

  return (
    <ToolbarContainer>
      <Stack>
        <Pagination
          current={page}
          count={length}
          total={total}
          pageSize={perPage}
          onChange={(page: number, perPage: number) => {
            setPagination?.({ page, perPage });
          }}
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
          icon={<DownloadIcon />}
          tooltip="Export to CSV"
          onClick={handleExport}
        />
      </Stack>
    </ToolbarContainer>
  );
}
