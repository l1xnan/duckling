import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { IconDecimal } from '@tabler/icons-react';
import * as dialog from '@tauri-apps/plugin-dialog';
import {
  CodeIcon,
  Columns3CogIcon,
  CrossIcon,
  DownloadIcon,
  EyeIcon,
  RefreshCw,
} from 'lucide-react';

import { Stack, ToolbarContainer } from '@/components/Toolbar';

import { exportCsv } from '@/api';
import { TransposeIcon } from '@/components/custom/Icons';
import { Pagination } from '@/components/custom/pagination';
import { TooltipButton } from '@/components/custom/tooltip';
import { SQLCodeViewer } from '@/components/editor/SingleLineEditor';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { SchemaType } from '@/stores/dataset';
import { TabContextType } from '@/stores/tabs';
import { useState } from 'react';
import { toast } from 'sonner';

export interface DataViewToolbarProps {
  context?: TabContextType;
  dbId: string;
  length: number;
  page: number;
  perPage: number;
  total: number;
  sql?: string;
  elapsed?: number;
  cross?: boolean;
  transpose?: boolean;
  columns?: SchemaType[];
  hiddenColumns?: Record<string, boolean>;
  setShowValue: () => void;
  refresh: () => void;
  setBeautify: () => void;
  setPagination?: (p: { page?: number; perPage?: number }) => void;
  setTranspose?: () => void;
  setCross?: () => void;

  setHiddenColumns?: (column: string, hidden: boolean) => void;
}

export function elapsedRender(elapsed?: number) {
  return elapsed ? `${elapsed}ms` : 'NA';
}

export function DataViewToolbar({
  context,
  dbId,
  length,
  page,
  perPage,
  total,
  sql,
  elapsed,
  cross,
  transpose,
  columns,
  hiddenColumns,
  setHiddenColumns,
  setShowValue,
  refresh,
  setBeautify,
  setPagination,
  setTranspose,
  setCross,
}: DataViewToolbarProps) {
  const [loading, setLoading] = useState(false);
  const handleExport = async () => {
    console.log('context:', context);
    const filename = context?.displayName ?? `xxx-${new Date().getTime()}.csv`;
    const file = await dialog.save({
      title: 'Export',
      defaultPath: filename,
      filters: [
        { name: 'CSV', extensions: ['csv'] },
        { name: 'Parquet', extensions: ['parquet'] },
        {
          name: 'XLSX',
          extensions: ['xlsx'],
        },
      ],
    });
    if (file && sql) {
      setLoading(true);
      try {
        await exportCsv({ file, dbId, sql });
      } catch (error) {
        console.error(error);
      }
      setLoading(false);
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
        <Popover>
          <PopoverTrigger asChild>
            <TooltipButton icon={<Columns3CogIcon />} tooltip="Hidden Column" />
          </PopoverTrigger>
          <PopoverContent>
            <div className="flex flex-col gap-2">
              <h4>Data Columns</h4>
              {columns?.map((column) => {
                return (
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id={column.name}
                      checked={!hiddenColumns?.[column.name]}
                      onCheckedChange={(value) => {
                        setHiddenColumns?.(column.name, !value);
                      }}
                    />
                    <Label htmlFor={column.name}>{column.name}</Label>
                  </div>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>

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

        <Popover>
          <PopoverTrigger>
            <TooltipButton disabled={!sql} icon={<CodeIcon />} />
          </PopoverTrigger>
          <PopoverContent className="h-[100px] pr-2">
            <SQLCodeViewer className="text-sm" sql={sql ?? ''} />
          </PopoverContent>
        </Popover>

        <TooltipButton
          icon={<EyeIcon />}
          onClick={setShowValue}
          tooltip="Value Viewer"
        />
        <TooltipButton
          icon={
            <DownloadIcon
              className={loading ? 'animate-spin duration-2000' : ''}
            />
          }
          tooltip="Export data"
          onClick={handleExport}
        />
      </Stack>
    </ToolbarContainer>
  );
}
