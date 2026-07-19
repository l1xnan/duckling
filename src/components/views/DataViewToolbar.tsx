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
  LayoutGridIcon,
  RefreshCw,
  SearchIcon,
  SquareIcon,
  XIcon,
} from 'lucide-react';

import { Stack, ToolbarContainer } from '@/components/Toolbar';

import { TransposeIcon } from '@/components/custom/Icons';
import { Pagination } from '@/components/custom/pagination';
import { TooltipButton } from '@/components/custom/tooltip';
import { useDialog } from '@/components/custom/use-dialog';
import { SQLCodeViewer } from '@/components/editor/SingleLineEditor';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
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
  /** Client-side result filter (current page). */
  resultFilter?: string;
  onResultFilterChange?: (value: string) => void;
  /** Optional: apply filter text into server WHERE. */
  onApplyFilterToWhere?: () => void;
  /** Open pivot table dialog. */
  onPivot?: () => void;
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
  resultFilter,
  onResultFilterChange,
  onApplyFilterToWhere,
  onPivot,
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

        {onResultFilterChange ? (
          <div className="flex items-center gap-1 ml-1">
            <div className="relative flex items-center">
              <SearchIcon className="absolute left-2 size-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={resultFilter ?? ''}
                onChange={(e) => onResultFilterChange(e.target.value)}
                placeholder={t`Filter results…`}
                className="h-7 w-36 pl-7 pr-7 text-xs"
              />
              {resultFilter ? (
                <button
                  type="button"
                  className="absolute right-1.5 text-muted-foreground hover:text-foreground"
                  onClick={() => onResultFilterChange('')}
                  aria-label={t`Clear filter`}
                >
                  <XIcon className="size-3.5" />
                </button>
              ) : null}
            </div>
            {onApplyFilterToWhere && resultFilter?.trim() ? (
              <TooltipButton
                icon={<CodeIcon className="size-3.5" />}
                onClick={onApplyFilterToWhere}
                tooltip={t`Apply filter to WHERE`}
              />
            ) : null}
          </div>
        ) : null}

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
        {onPivot ? (
          <TooltipButton
            icon={<LayoutGridIcon />}
            onClick={onPivot}
            tooltip={t`Pivot table`}
          />
        ) : null}

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
