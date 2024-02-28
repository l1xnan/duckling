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
  if (titles.length == 0) {
    return null;
  }

  // const first = {
  //   field: '',
  //   title: '',
  //   width: 50,
  //   cellType: 'checkbox',
  //   headerType: 'checkbox',
  // };

  const columns =
    titles?.map((col, i) => {
      return <ListColumn field={col.name} caption={col.name} />;
    }) ?? [];
  console.log(data);
  return (
    <div ref={ref} className="h-full">
      <ListTable
        height={height - 32}
        records={data}
        heightMode="autoHeight"
        widthMode="autoWidth"
        showFrozenIcon={true}
        frozenColCount={2}
        dragHeaderMode="column"
        menu={{
          contextMenuItems: ['Copy Cell', 'Copy Column'],
        }}
        hover={{
          highlightMode: 'cross',
          // enableSingleHighlight: false,
        }}
        keyboardOptions={{
          moveEditCellOnArrowKeys: true,
          copySelected: true,
          pasteValueToCell: true,
        }}
        theme={{
          defaultStyle: {
            fontSize: 12,
            fontFamily: 'Consolas',
            borderLineWidth: 1,
            borderColor: '#f2f2f2',
            hover: {
              cellBgColor: '#9cbef4',
              inlineRowBgColor: '#9cbef4',
              inlineColumnBgColor: '#9cbef4',
            },
          },
          bodyStyle: {
            hover: {
              cellBgColor: '#c3dafd',
              inlineRowBgColor: '#c3dafd',
              inlineColumnBgColor: '#c3dafd',
            },
          },
        }}
      >
        {columns}
      </ListTable>
    </div>
  );
}
