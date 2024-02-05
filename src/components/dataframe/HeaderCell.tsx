import { Box } from '@mui/material';
import {
  IconCaretDownFilled,
  IconCaretUpDownFilled,
  IconCaretUpFilled,
} from '@tabler/icons-react';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { ColumnState, GridApi } from 'ag-grid-community';
import dedent from 'dedent';
import { PinIcon, PinOffIcon } from 'lucide-react';

import { ContextMenuItem } from '@/components/custom/context-menu';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { usePageStore } from '@/stores/dataset';
import { useTabsStore } from '@/stores/tabs';

// https://ag-grid.com/react-data-grid/component-header/
interface HeadCellProps {
  displayName: string;
  api: GridApi;
  pin: (s: ColumnState) => void;
  column: {
    colId: string;
  };
}

export default (props: HeadCellProps) => {
  const {
    context: table,
    orderBy,
    setOrderBy,
    setDialogColumn,
  } = usePageStore();
  const updateTab = useTabsStore((state) => state.update);

  const key = props.column.colId;
  const isDesc = orderBy?.name == key ? orderBy?.desc : undefined;

  if (props.column.colId == '__index__') {
    return;
  }

  const pinColumn = ({ colId, pinned }: ColumnState) => {
    const state = props.api.getColumnState();
    console.log('state:', state);

    props.api.applyColumnState({
      state: state.map((col) =>
        col.colId === colId
          ? { colId, pinned }
          : {
              colId: col.colId,
              pinned: col.pinned,
            },
      ),
      defaultState: { pinned: null },
    });
  };

  const handleOrder = () => {
    setOrderBy?.(key);
  };
  return (
    <ContextMenu
      onOpenChange={(open) => {
        if (open) {
          setDialogColumn(props.column.colId);
        }
      }}
    >
      <ContextMenuTrigger className="w-full">
        <div
          className="flex items-center justify-between w-full h-20 px-1 text-sm"
          onClick={handleOrder}
        >
          <div>{props.displayName}</div>
          <AscOrDescIcon isDesc={isDesc} />
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-64">
        <ContextMenuItem
          onClick={async () => {
            await writeText(props.displayName);
          }}
        >
          Copy field name
        </ContextMenuItem>
        <ContextMenuItem
          disabled
          onClick={() => {
            if (table) {
              updateTab({
                ...table,
                id: `${table.id}-query`,
                type: 'editor',
                displayName: `query[${table.tableName}]`,
                extra: dedent`
                select ${props.column.colId}, count(*) 
                from ${table.tableName}
                group by ${props.column.colId};
                `,
              });
            }
          }}
        >
          Count(group by)
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          icon={PinIcon}
          onClick={() => {
            pinColumn({
              colId: key,
              pinned: 'left',
            });
          }}
        >
          Pin to left
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => {
            pinColumn({
              colId: key,
              pinned: 'right',
            });
          }}
        >
          Pin to right
        </ContextMenuItem>
        <ContextMenuItem
          icon={PinOffIcon}
          onClick={() => {
            pinColumn({
              colId: key,
              pinned: null,
            });
          }}
        >
          Clear Pinned
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};

const AscOrDescIcon = ({ isDesc }: { isDesc?: boolean }) => {
  return (
    <Box
      sx={{
        fontSize: 1,
        '& *': {
          maxHeight: '12px',
          height: '12px',
          maxWidth: '12px',
          fontWeight: 400,
        },
      }}
    >
      {isDesc === undefined ? (
        <IconCaretUpDownFilled />
      ) : !isDesc ? (
        <IconCaretUpFilled />
      ) : (
        <IconCaretDownFilled />
      )}
    </Box>
  );
};
