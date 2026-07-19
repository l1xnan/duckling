import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { IconDecimal } from '@tabler/icons-react';
import {
  CodeIcon,
  Columns3CogIcon,
  CrossIcon,
  DownloadIcon,
  EyeIcon,
  RefreshCw,
  SquareIcon,
} from 'lucide-react';

import { Stack, ToolbarContainer } from '@/components/Toolbar';

import { TransposeIcon } from '@/components/custom/Icons';
import { Pagination } from '@/components/custom/pagination';
import { TooltipButton } from '@/components/custom/tooltip';
import { useDialog } from '@/components/custom/use-dialog';
import { SQLCodeViewer } from '@/components/editor/SingleLineEditor';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ExportDialog } from '@/components/views/ExportDialog';
import { i18n } from '@/i18n';
import { canExport } from '@/lib/capabilities';
import { SchemaType } from '@/stores/dataset';
import { getStoredDB } from '@/stores/dbList';
import { TabContextType } from '@/stores/tabs';

export interface DataViewToolbarProps {
  context?: TabContextType;
  dbId: string;
  /** Dialect name for capability gating (falls back to stored connection). */
  dialect?: string;
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
  /** When true, show stop button instead of only refresh. */
  loading?: boolean;
  onCancel?: () => void;
}

export function elapsedRender(elapsed?: number) {
  return elapsed ? `${elapsed}ms` : i18n._(msg`N/A`);
}

export function DataViewToolbar({
  context,
  dbId,
  dialect,
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
  loading,
  onCancel,
}: DataViewToolbarProps) {
  const { t } = useLingui();
  const exportDialog = useDialog();
  const resolvedDialect = dialect ?? getStoredDB(dbId)?.dialect;
  const exportAllowed = canExport(resolvedDialect);

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
          tooltip={t`Float precision`}
        />

        {loading && onCancel ? (
          <TooltipButton
            icon={<SquareIcon className="size-3.5 fill-current" />}
            onClick={() => {
              void onCancel();
            }}
            tooltip={t`Stop query`}
          />
        ) : (
          <TooltipButton
            icon={<RefreshCw />}
            onClick={async () => {
              await refresh();
            }}
            tooltip={t`Refresh`}
          />
        )}
        <div className="text-xs ml-6">
          <Trans>elapsed time: {elapsedRender(elapsed)}</Trans>
        </div>
      </Stack>
      <Stack>
        <Popover>
          <PopoverTrigger
            render={<TooltipButton icon={<Columns3CogIcon />} tooltip={t`Hidden Column`} />}
          ></PopoverTrigger>
          <PopoverContent>
            <div className="flex flex-col gap-2">
              <h4>
                <Trans>Data Columns</Trans>
              </h4>
              {columns?.map((column) => {
                return (
                  <div className="flex items-center gap-3" key={column.name}>
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

        <TooltipButton icon={<CrossIcon />} onClick={setCross} tooltip={t`Cross`} active={cross} />
        <TooltipButton
          icon={<TransposeIcon />}
          onClick={setTranspose}
          tooltip={t`Transpose`}
          active={transpose}
        />

        <Popover>
          <PopoverTrigger
            render={<TooltipButton disabled={!sql} icon={<CodeIcon />} />}
          ></PopoverTrigger>
          <PopoverContent className="h-[100px] pr-2">
            <SQLCodeViewer className="text-sm" sql={sql ?? ''} />
          </PopoverContent>
        </Popover>

        <TooltipButton icon={<EyeIcon />} onClick={setShowValue} tooltip={t`Value Viewer`} />
        <TooltipButton
          icon={<DownloadIcon />}
          tooltip={
            !exportAllowed
              ? t`Export is not supported for this connection`
              : !sql
                ? t`No SQL to export`
                : t`Export data`
          }
          disabled={!sql || !exportAllowed}
          onClick={exportDialog.trigger}
        />
      </Stack>

      <ExportDialog
        {...exportDialog.props}
        dbId={dbId}
        dialect={resolvedDialect}
        sql={sql}
        defaultName={context?.displayName}
      />
    </ToolbarContainer>
  );
}
