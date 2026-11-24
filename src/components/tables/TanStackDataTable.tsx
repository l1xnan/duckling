import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { useLingui } from '@lingui/react/macro';
import {
  columnPinningFeature,
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  useTable,
  type CellData,
  type ColumnDef,
  type Row,
  type TableFeatures,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { toast } from 'sonner';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';

import { ContextMenuItem } from '@/components/custom/context-menu';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/custom/ui/context-menu';
import { formatCellForGrid } from '@/components/tables/format';
import {
  columnPinningFor,
  estimateColumnWidth,
  selectionBounds,
  transposeRecords,
} from '@/components/tables/tanstackGrid';
import type { TableProps } from '@/components/tables/CanvasTable';
import type { SelectedCellType } from '@/components/views/TableView';
import { formatHotkey, getHotkey } from '@/hotkeys';
import {
  planCopy,
  type ClipboardCell,
  type CopyFormat,
} from '@/lib/tableClipboard';
import { useTableFontFamily, useTableFontSize } from '@/stores/setting';
import type { SchemaType } from '@/stores/dataset';
import { cn } from '@/lib/utils';
import { isNumberType, isNumericSqlType } from '@/utils';

const ROW_H = 24;
const HEADER_H = 28;
const features = {
  columnVisibilityFeature,
  columnPinningFeature,
  columnSizingFeature,
  columnResizingFeature,
} satisfies TableFeatures;

type GridRow = Record<string, unknown>;
type GridColumn = ColumnDef<typeof features, GridRow, CellData>;
type GridTableRow = Row<typeof features, GridRow>;

const COPY_TOAST_ROW_THRESHOLD = 2000;

function headerText(column: { id: string; columnDef: { header?: unknown } }) {
  return typeof column.columnDef.header === 'string' ? column.columnDef.header : column.id;
}

function asCellValue(value: unknown): SelectedCellType['value'] {
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (value == null) return undefined;
  return String(value);
}

function headerLabel(
  name: string,
  orderBy: TableProps['orderBy'],
): string {
  if (orderBy?.name !== name) return name;
  return `${name} ${orderBy.desc ? '↓' : '↑'}`;
}

function recordIndexFromId(id: string): number | null {
  if (!id.startsWith('r')) return null;
  const index = Number(id.slice(1));
  return Number.isInteger(index) ? index : null;
}

export function TanStackDataTable(props: TableProps) {
  const { schema } = props;
  if ((schema?.length ?? 0) === 0) return null;
  return <TanStackDataTableInner {...props} schema={schema} />;
}

function TanStackDataTableInner({
  data,
  schema,
  beautify,
  precision,
  transpose,
  cross,
  style,
  orderBy,
  hiddenColumns,
  setHiddenColumns,
  onSelectedCell,
  onSelectedCellInfos,
  onColumnProfile,
  onPivotColumn,
  onOrderByColumn,
  onDrillDown,
}: TableProps & { schema: SchemaType[] }) {
  const { t } = useLingui();
  const fontFamily = useTableFontFamily();
  const fontSize = useTableFontSize();
  const records = data as GridRow[];
  const scrollRef = useRef<HTMLDivElement>(null);
  const [columnPinning, setColumnPinning] = useState(() =>
    columnPinningFor([], []),
  );
  const [columnSizing, setColumnSizing] = useState<Record<string, number>>({});
  const [anchor, setAnchor] = useState<{ row: number; col: number } | null>(null);
  const [focus, setFocus] = useState<{ row: number; col: number } | null>(null);
  const [menuCell, setMenuCell] = useState<{ row: number; col: number } | null>(null);
  const dragging = useRef(false);

  const schemaByName = useMemo(
    () => new Map(schema.map((column) => [column.name, column])),
    [schema],
  );

  const gridColumns = useMemo<GridColumn[]>(() => {
    if (transpose) {
      const label: GridColumn = {
        id: '__field',
        accessorKey: '__field',
        header: '',
        size: 160,
        enableResizing: false,
      };
      const recordColumns = records.map((_, index) => ({
        id: `r${index}`,
        accessorKey: `r${index}`,
        header: String(index + 1),
        size: 120,
      })) satisfies GridColumn[];
      return [label, ...recordColumns];
    }
    const series: GridColumn = {
      id: '#',
      accessorFn: (_row, index) => index + 1,
      header: '',
      size: 44,
      enableResizing: false,
    };
    const fields = schema.map((column) => {
      const samples = records.slice(0, 24).map((row) => {
        const value = row[column.name];
        return value == null ? '' : String(value);
      });
      return {
        id: column.name,
        accessorKey: column.name,
        header: headerLabel(column.name, orderBy),
        size: estimateColumnWidth([column.name, ...samples], fontSize),
      } satisfies GridColumn;
    });
    return [series, ...fields];
  }, [fontSize, orderBy, records, schema, transpose]);

  const gridData = useMemo(() => {
    if (!transpose) return records;
    const names = schema
      .filter((column) => !hiddenColumns?.[column.name])
      .map((column) => column.name);
    return transposeRecords(names, records);
  }, [hiddenColumns, records, schema, transpose]);

  const columnVisibility = useMemo(() => {
    if (transpose) return {};
    const visibility: Record<string, boolean> = {};
    for (const column of schema) {
      if (hiddenColumns?.[column.name]) visibility[column.name] = false;
    }
    return visibility;
  }, [hiddenColumns, schema, transpose]);

  const pinning = transpose
    ? { start: ['__field'], end: [] as string[] }
    : columnPinning;

  const table = useTable({
    features,
    data: gridData,
    columns: gridColumns,
    state: {
      columnVisibility,
      columnPinning: pinning,
      columnSizing,
    },
    onColumnPinningChange: (updater) => {
      setColumnPinning((prev) =>
        typeof updater === 'function' ? updater(prev) : updater,
      );
    },
    onColumnSizingChange: (updater) => {
      setColumnSizing((prev) =>
        typeof updater === 'function' ? updater(prev) : updater,
      );
    },
  });

  const rows = table.getRowModel().rows;
  const left = table.getStartVisibleLeafColumns();
  const center = table.getCenterVisibleLeafColumns();
  const right = table.getEndVisibleLeafColumns();
  const leaf = useMemo(
    () => [...left, ...center, ...right],
    [left, center, right],
  );

  const leftWidth = left.reduce((sum, column) => sum + column.getSize(), 0);
  const rightWidth = right.reduce((sum, column) => sum + column.getSize(), 0);
  const totalWidth =
    leftWidth +
    center.reduce((sum, column) => sum + column.getSize(), 0) +
    rightWidth;

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_H,
    overscan: 8,
  });
  const colVirtualizer = useVirtualizer({
    horizontal: true,
    count: center.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => center[index]?.getSize() ?? 120,
    overscan: 3,
  });

  useEffect(() => {
    setAnchor(null);
    setFocus(null);
  }, [records, schema, transpose]);

  const readCell = useCallback(
    (displayRow: number, displayCol: number): SelectedCellType | null => {
      const column = leaf[displayCol];
      if (!column) return null;
      if (displayRow === 0) {
        const field = column.id === '#' || column.id === '__field' ? undefined : column.id;
        const title =
          typeof column.columnDef.header === 'string' ? column.columnDef.header : column.id;
        return { row: 0, col: displayCol, value: title, field };
      }
      const bodyIndex = displayRow - 1;
      if (transpose) {
        const field = String(rows[bodyIndex]?.getValue('__field') ?? '');
        const recordIndex = recordIndexFromId(column.id);
        const record = recordIndex == null ? undefined : records[recordIndex];
        const raw = column.id === '__field' ? field : record?.[field];
        return {
          row: displayRow,
          col: displayCol,
          value: asCellValue(raw),
          field: field || undefined,
          record,
        };
      }
      const row = rows[bodyIndex] as GridTableRow | undefined;
      const record = row?.original;
      if (column.id === '#') {
        return {
          row: displayRow,
          col: displayCol,
          value: bodyIndex + 1,
          record,
        };
      }
      return {
        row: displayRow,
        col: displayCol,
        value: asCellValue(record?.[column.id]),
        field: column.id,
        record,
      };
    },
    [leaf, records, rows, transpose],
  );

  const readCellRef = useRef(readCell);
  readCellRef.current = readCell;

  useEffect(() => {
    const read = readCellRef.current;
    if (!anchor || !focus) {
      onSelectedCell?.(null);
      onSelectedCellInfos?.(null);
      return;
    }
    const range = selectionBounds(anchor, focus);
    const infos: SelectedCellType[][] = [];
    for (let row = range.r0; row <= range.r1; row += 1) {
      const line: SelectedCellType[] = [];
      for (let col = range.c0; col <= range.c1; col += 1) {
        const cell = read(row, col);
        if (cell) line.push(cell);
      }
      infos.push(line);
    }
    onSelectedCellInfos?.(infos);
    onSelectedCell?.(read(focus.row, focus.col));
  }, [anchor, focus, onSelectedCell, onSelectedCellInfos, records, transpose]);

  const bounds = anchor && focus ? selectionBounds(anchor, focus) : null;

  const selectAt = (row: number, col: number, extend: boolean) => {
    setFocus({ row, col });
    setAnchor((current) => (extend && current ? current : { row, col }));
    scrollRef.current?.focus();
  };

  const displayOf = (cell: SelectedCellType | null) => {
    if (!cell) return '';
    if (cell.row === 0 || !cell.field) {
      return cell.value == null ? '' : String(cell.value);
    }
    const column = schemaByName.get(cell.field);
    const raw = cell.record ? cell.record[cell.field] : cell.value;
    if (!column) return raw == null ? '' : String(raw);
    const formatted = formatCellForGrid(raw, column.dataType, {
      dataType: column.dataType,
      type: column.type,
      beautify,
      precision,
    });
    return formatted == null ? '' : String(formatted);
  };

  const clipboardCells = (): ClipboardCell[][] | null => {
    if (!bounds) return null;
    const matrix: ClipboardCell[][] = [];
    for (let row = bounds.r0; row <= bounds.r1; row += 1) {
      const line: ClipboardCell[] = [];
      for (let col = bounds.c0; col <= bounds.c1; col += 1) {
        const cell = readCell(row, col);
        if (!cell) continue;
        line.push({
          row,
          col,
          value: cell.row === 0 ? cell.value : cell.value,
          title: leaf[col] ? headerText(leaf[col]) : undefined,
          field: cell.field,
        });
      }
      matrix.push(line);
    }
    return matrix;
  };

  const copyText = async (text: string, rowCount: number) => {
    try {
      await writeText(text);
      if (rowCount >= COPY_TOAST_ROW_THRESHOLD) {
        toast.success(`${t`Copied`}: ${rowCount}`);
      }
    } catch (error) {
      toast.error(
        `${t`Copy failed`}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  const copyPlain = async () => {
    if (!bounds) return;
    const lines: string[] = [];
    for (let row = bounds.r0; row <= bounds.r1; row += 1) {
      const cells: string[] = [];
      for (let col = bounds.c0; col <= bounds.c1; col += 1) {
        cells.push(displayOf(readCell(row, col)));
      }
      lines.push(cells.join('\t'));
    }
    await copyText(lines.join('\n'), Math.max(0, bounds.r1 - bounds.r0));
  };

  const copyFormat = async (format: CopyFormat) => {
    const cells = clipboardCells();
    if (!cells) return;
    const plan = planCopy({ transpose: Boolean(transpose), cells }, format);
    if (!plan?.text) return;
    await copyText(plan.text, plan.rowCount);
  };

  const onCopy = (event: ClipboardEvent<HTMLDivElement>) => {
    if (!bounds) return;
    event.preventDefault();
    void copyPlain();
  };

  const beginResize = (columnId: string, event: ReactPointerEvent) => {
    if (columnId === '#') return;
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const start = leaf.find((column) => column.id === columnId)?.getSize() ?? 120;
    const move = (ev: PointerEvent) => {
      const next = Math.max(48, Math.round(start + ev.clientX - startX));
      setColumnSizing((prev) => ({ ...prev, [columnId]: next }));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const menuColumn = menuCell ? leaf[menuCell.col] : undefined;
  const menuField =
    menuColumn && menuColumn.id !== '#' && menuColumn.id !== '__field' && !menuColumn.id.startsWith('r')
      ? menuColumn.id
      : menuCell && transpose && menuCell.row > 0
        ? String(rows[menuCell.row - 1]?.getValue('__field') ?? '')
        : undefined;
  const menuIsHeader = menuCell?.row === 0;

  const renderCell = (
    column: (typeof leaf)[number],
    displayCol: number,
    displayRow: number,
    leftPx: number,
    topPx: number,
    pinned: boolean,
  ) => {
    const cell = readCell(displayRow, displayCol);
    const text = displayOf(cell);
    const selected = Boolean(
      bounds &&
        displayRow >= bounds.r0 &&
        displayRow <= bounds.r1 &&
        displayCol >= bounds.c0 &&
        displayCol <= bounds.c1,
    );
    const highlighted = Boolean(
      focus &&
        (cross
          ? displayRow === focus.row || displayCol === focus.col
          : displayRow === focus.row && displayRow !== 0),
    );
    const schemaColumn = cell?.field ? schemaByName.get(cell.field) : undefined;
    const numeric = Boolean(
      schemaColumn &&
        (isNumberType(schemaColumn.dataType) || isNumericSqlType(schemaColumn.type)),
    );
    const raw = cell?.field && cell.record ? cell.record[cell.field] : cell?.value;
    const isHeader = displayRow === 0;
    const isSeries = column.id === '#';
    const striped = !isHeader && displayRow % 2 === 0;
    return (
      <div
        key={`${displayRow}-${column.id}`}
        data-cell="true"
        data-row={displayRow}
        data-col={displayCol}
        className={cn(
          'absolute box-border overflow-hidden border-r border-b border-border px-1.5 whitespace-nowrap',
          numeric && !isHeader && 'text-right',
          isSeries && 'text-center text-muted-foreground/70',
          isHeader && 'bg-muted font-medium',
          !isHeader && !isSeries && raw == null && 'text-muted-foreground',
          !isHeader && raw === '' && 'text-orange-700 italic',
          !isHeader && typeof raw === 'number' && !Number.isFinite(raw) && 'text-destructive font-medium',
        )}
        style={{
          left: leftPx,
          top: topPx,
          width: column.getSize(),
          height: isHeader ? HEADER_H : ROW_H,
          lineHeight: `${isHeader ? HEADER_H : ROW_H}px`,
          fontSize,
          zIndex: pinned ? (isHeader ? 4 : 2) : isHeader ? 3 : 0,
          backgroundColor: isHeader
            ? undefined
            : selected
              ? 'color-mix(in srgb, var(--primary) 15%, var(--background))'
              : highlighted
                ? 'color-mix(in srgb, var(--accent) 40%, var(--background))'
                : striped
                  ? 'color-mix(in srgb, var(--foreground) 2%, var(--background))'
                  : 'var(--background)',
        }}
        title={
          isHeader && schemaColumn
            ? `${schemaColumn.name}: ${schemaColumn.type ?? String(schemaColumn.dataType)}`
            : undefined
        }
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          dragging.current = true;
          selectAt(displayRow, displayCol, event.shiftKey);
        }}
        onPointerEnter={() => {
          if (!dragging.current) return;
          setFocus({ row: displayRow, col: displayCol });
        }}
      >
        {text}
        {isHeader && !isSeries ? (
          <div
            className="absolute top-0 right-0 h-full w-1 cursor-col-resize"
            onPointerDown={(event) => beginResize(column.id, event)}
          />
        ) : null}
      </div>
    );
  };

  const virtualCols = colVirtualizer.getVirtualItems();
  const virtualRows = rowVirtualizer.getVirtualItems();
  let leftOffset = 0;
  const leftPlaced = left.map((column) => {
    const placed = { column, left: leftOffset, index: leaf.indexOf(column) };
    leftOffset += column.getSize();
    return placed;
  });
  let rightOffset = 0;
  const rightPlaced = right.map((column) => {
    const placed = { column, left: rightOffset, index: leaf.indexOf(column) };
    rightOffset += column.getSize();
    return placed;
  });

  return (
    <ContextMenu>
      <ContextMenuTrigger
        className="block h-full min-h-0 w-full min-w-0 select-none"
        style={style}
      >
        <div
          ref={scrollRef}
          tabIndex={0}
          className="h-full min-h-0 w-full overflow-auto bg-background text-foreground outline-none"
          style={{ fontFamily }}
          onCopy={onCopy}
          onPointerUp={() => {
            dragging.current = false;
          }}
          onPointerLeave={() => {
            dragging.current = false;
          }}
          onContextMenu={(event) => {
            const element = (event.target as HTMLElement).closest('[data-cell]');
            if (!(element instanceof HTMLElement)) return;
            setMenuCell({
              row: Number(element.dataset.row),
              col: Number(element.dataset.col),
            });
          }}
        >
          <div
            className="relative"
            style={{ width: totalWidth, height: HEADER_H + rowVirtualizer.getTotalSize() }}
          >
            <div
              className="sticky top-0 z-20 bg-muted"
              style={{ height: HEADER_H, width: totalWidth }}
            >
              {virtualCols.map((virtual) => {
                const column = center[virtual.index];
                if (!column) return null;
                return renderCell(
                  column,
                  left.length + virtual.index,
                  0,
                  leftWidth + virtual.start,
                  0,
                  false,
                );
              })}
            </div>
            {virtualRows.map((virtual) => (
              <div key={virtual.key}>
                {virtualCols.map((virtualCol) => {
                  const column = center[virtualCol.index];
                  if (!column) return null;
                  return renderCell(
                    column,
                    left.length + virtualCol.index,
                    virtual.index + 1,
                    leftWidth + virtualCol.start,
                    HEADER_H + virtual.start,
                    false,
                  );
                })}
              </div>
            ))}
            {leftWidth > 0 ? (
              <div
                className="sticky left-0 z-30 bg-background"
                style={{ width: leftWidth, height: HEADER_H + rowVirtualizer.getTotalSize(), marginTop: -HEADER_H }}
              >
                <div className="sticky top-0 z-40 bg-muted" style={{ height: HEADER_H, width: leftWidth }}>
                  {leftPlaced.map((item) =>
                    renderCell(item.column, item.index, 0, item.left, 0, true),
                  )}
                </div>
                <div className="relative" style={{ height: rowVirtualizer.getTotalSize() }}>
                  {virtualRows.map((virtual) =>
                    leftPlaced.map((item) =>
                      renderCell(
                        item.column,
                        item.index,
                        virtual.index + 1,
                        item.left,
                        virtual.start,
                        true,
                      ),
                    ),
                  )}
                </div>
              </div>
            ) : null}
            {rightWidth > 0 ? (
              <div
                className="sticky z-30 ml-auto bg-background"
                style={{
                  right: 0,
                  width: rightWidth,
                  height: HEADER_H + rowVirtualizer.getTotalSize(),
                  marginTop: -(HEADER_H + rowVirtualizer.getTotalSize()),
                }}
              >
                <div className="sticky top-0 z-40 bg-muted" style={{ height: HEADER_H, width: rightWidth }}>
                  {rightPlaced.map((item) =>
                    renderCell(item.column, item.index, 0, item.left, 0, true),
                  )}
                </div>
                <div className="relative" style={{ height: rowVirtualizer.getTotalSize() }}>
                  {virtualRows.map((virtual) =>
                    rightPlaced.map((item) =>
                      renderCell(
                        item.column,
                        item.index,
                        virtual.index + 1,
                        item.left,
                        virtual.start,
                        true,
                      ),
                    ),
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        {menuIsHeader && !transpose && menuField ? (
          <>
            <ContextMenuItem
              onClick={() => {
                void writeText(menuField);
              }}
            >
              {t`Copy Field Name`}
            </ContextMenuItem>
            {onOrderByColumn ? (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem
                  onClick={() => onOrderByColumn(menuField, { desc: false })}
                >
                  {t`Sort ascending`}
                </ContextMenuItem>
                <ContextMenuItem
                  onClick={() => onOrderByColumn(menuField, { desc: true })}
                >
                  {t`Sort descending`}
                </ContextMenuItem>
                <ContextMenuItem
                  onClick={() => onOrderByColumn(menuField, { clear: true })}
                >
                  {t`Clear sort`}
                </ContextMenuItem>
              </>
            ) : null}
            {onColumnProfile || onPivotColumn ? <ContextMenuSeparator /> : null}
            {onColumnProfile ? (
              <ContextMenuItem onClick={() => onColumnProfile(menuField)}>
                {t`Column profile`}
              </ContextMenuItem>
            ) : null}
            {onPivotColumn ? (
              <ContextMenuItem onClick={() => onPivotColumn(menuField)}>
                {t`Pivot with this column`}
              </ContextMenuItem>
            ) : null}
            <ContextMenuSeparator />
            <ContextMenuItem
              onClick={() => {
                const column = leaf.find((item) => item.id === menuField);
                column?.pin('start');
              }}
            >
              {t`Pin to left`}
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => {
                const column = leaf.find((item) => item.id === menuField);
                column?.pin('end');
              }}
            >
              {t`Pin to right`}
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => setColumnPinning(columnPinningFor([], []))}
            >
              {t`Clear pinned`}
            </ContextMenuItem>
            <ContextMenuItem onClick={() => setHiddenColumns(menuField, true)}>
              {t`Hidden column`}
            </ContextMenuItem>
          </>
        ) : (
          <>
            <ContextMenuItem
              shortcut={formatHotkey(getHotkey('table.copy'))}
              onClick={() => void copyPlain()}
            >
              {t`Copy`}
            </ContextMenuItem>
            <ContextMenuSub>
              <ContextMenuSubTrigger inset>{t`Advanced copy`}</ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-44">
                <ContextMenuItem onClick={() => void copyFormat('csv-no-header')}>
                  {t`Copy as CSV`}
                </ContextMenuItem>
                <ContextMenuItem onClick={() => void copyFormat('csv-header')}>
                  {t`Copy as CSV with header`}
                </ContextMenuItem>
                <ContextMenuItem onClick={() => void copyFormat('tsv')}>
                  {t`Copy as TSV`}
                </ContextMenuItem>
                <ContextMenuItem onClick={() => void copyFormat('markdown')}>
                  {t`Copy as Markdown table`}
                </ContextMenuItem>
                <ContextMenuItem onClick={() => void copyFormat('html')}>
                  {t`Copy as HTML table`}
                </ContextMenuItem>
                <ContextMenuItem onClick={() => void copyFormat('json')}>
                  {t`Copy as JSON`}
                </ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>
            {onDrillDown && menuField && menuCell && menuCell.row > 0 ? (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem
                  onClick={() => {
                    const cell = readCell(menuCell.row, menuCell.col);
                    onDrillDown(menuField, cell?.value);
                  }}
                >
                  {t`Filter by this value`}
                </ContextMenuItem>
              </>
            ) : null}
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
