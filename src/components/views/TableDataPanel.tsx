import {
  Suspense,
  startTransition,
  useCallback,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';

import { CanvasTable } from '@/components/tables/CanvasTable';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { Direction, OrderByType, SchemaType } from '@/stores/dataset';

import { Loading, SelectedCellType } from './TableView';
import { ValueViewer } from './ValueViewer';

export type TableDataPanelProps = {
  loading?: boolean;
  data: unknown[];
  schema: SchemaType[];
  hiddenColumns: Record<string, boolean>;
  setHiddenColumns: (col: string, hidden: boolean) => void;
  beautify?: boolean;
  precision?: number;
  orderBy?: OrderByType;
  transpose?: boolean;
  cross?: boolean;
  style?: CSSProperties;
  showValue?: boolean;
  direction: Direction;
  setShowValue: () => void;
  setDirection: () => void;
  onOrderByColumn?: (
    columnName: string,
    options?: { desc?: boolean; clear?: boolean },
  ) => void;
  onCountByColumn?: (columnName: string) => void;
  onProfileColumn?: (columnName: string) => void;
  onPivotColumn?: (columnName: string) => void;
  onDrillDown?: (columnName: string, value: unknown) => void;
  beforeTable?: ReactNode;
  emptyOverlay?: ReactNode;
};

export function TableDataPanel({
  loading,
  data,
  schema,
  hiddenColumns,
  setHiddenColumns,
  beautify,
  precision,
  orderBy,
  transpose,
  cross,
  style,
  showValue,
  direction,
  setShowValue,
  setDirection,
  onOrderByColumn,
  onCountByColumn,
  onProfileColumn,
  onPivotColumn,
  onDrillDown,
  beforeTable,
  emptyOverlay,
}: TableDataPanelProps) {
  const [selectedCell, setSelectCell] = useState<SelectedCellType | null>();
  const [selectedCellInfos, setSelectedCellInfos] = useState<
    SelectedCellType[][] | null
  >();

  const onSelectedCell = useCallback((arg: SelectedCellType | null) => {
    startTransition(() => {
      setSelectCell(arg);
    });
  }, []);

  const onSelectedCellInfos = useCallback(
    (cells: SelectedCellType[][] | null) => {
      startTransition(() => {
        setSelectedCellInfos(cells);
      });
    },
    [],
  );

  const hideTable = loading || Boolean(emptyOverlay);

  return (
    <ResizablePanelGroup
      orientation={direction}
      className="min-h-0 min-w-0 flex-1"
    >
      <ResizablePanel
        defaultSize={80}
        className="min-h-0 min-w-0 overflow-hidden"
      >
        <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
          {beforeTable}
          <div className="mb-px min-h-0 flex-1 overflow-hidden">
            <Suspense fallback={<Loading />}>
              {loading ? <Loading /> : null}
              {emptyOverlay}
              <CanvasTable
                style={hideTable ? { display: 'none', ...style } : style}
                data={data}
                schema={schema}
                hiddenColumns={hiddenColumns}
                setHiddenColumns={setHiddenColumns}
                beautify={beautify}
                orderBy={orderBy}
                precision={precision}
                transpose={transpose}
                cross={cross}
                onSelectedCell={onSelectedCell}
                onSelectedCellInfos={onSelectedCellInfos}
                onCountByColumn={onCountByColumn}
                onProfileColumn={onProfileColumn}
                onPivotColumn={onPivotColumn}
                onOrderByColumn={onOrderByColumn}
                onDrillDown={onDrillDown}
              />
            </Suspense>
          </div>
        </div>
      </ResizablePanel>
      {showValue ? (
        <>
          <ResizableHandle withHandle />
          <ResizablePanel
            defaultSize={20}
            className="min-h-0 min-w-0 overflow-hidden"
          >
            <div className="size-full min-h-0 min-w-0 overflow-hidden">
              <ValueViewer
                selectedCell={selectedCell}
                selectedCellInfos={selectedCellInfos}
                setShowValue={setShowValue}
                setDirection={setDirection}
                direction={direction}
              />
            </div>
          </ResizablePanel>
        </>
      ) : null}
    </ResizablePanelGroup>
  );
}
