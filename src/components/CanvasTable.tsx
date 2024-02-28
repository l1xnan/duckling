import { ListColumn, ListTable } from '@visactor/react-vtable';
import useResizeObserver from 'use-resize-observer';

import { TableProps } from '@/components/AgTable.tsx';

export function CanvasTable({
  data,
  titles,
  schema,
  beautify,
  orderBy,
  precision,
  ...rest
}: TableProps) {
  const { ref, height = 100 } = useResizeObserver<HTMLDivElement>();
  const columns: any[] = [];
  return (
    <div ref={ref} className="h-full">
      <ListTable height={height - 32} heightMode={'autoHeight'} records={data}>
        {titles?.map((col, i) => {
          return <ListColumn field={i} caption={col.name} />;
        })}
      </ListTable>
    </div>
  );
}
