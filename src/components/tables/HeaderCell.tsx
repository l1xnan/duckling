import { Box } from '@mui/material';
import {
  IconCaretDownFilled,
  IconCaretUpDownFilled,
  IconCaretUpFilled,
} from '@tabler/icons-react';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { ColumnState, GridApi } from 'ag-grid-community';
import { PinIcon, PinOffIcon } from 'lucide-react';

import { ContextMenuItem } from '@/components/custom/context-menu';
import { Tooltip } from '@/components/custom/tooltip';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

import { usePageStore } from '@/hooks/context';

// https://ag-grid.com/react-data-grid/component-header/
interface HeadCellProps {
  displayName: string;
  api: GridApi;
  pin: (s: ColumnState) => void;
  column: {
    colId: string;
    colDef: Record<string, string>;
  };
}

export default (props: HeadCellProps) => {
  const { orderBy, setOrderBy, setDialogColumn } = usePageStore();
  const colId = props.column.colId;
  const sqlType = props.column?.colDef?.sqlType;
  const isDesc = orderBy?.name == colId ? orderBy?.desc : undefined;

  if (props.column.colId == '__index__') {
    return;
  }

  const pinColumn = ({ colId, pinned }: ColumnState) => {
    const state = props.api.getColumnState();

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
    setOrderBy?.(colId);
  };

  const { displayName } = props;
  return (
    <ContextMenu
      onOpenChange={(open) => {
        if (open) {
          setDialogColumn(colId);
        }
      }}
    >
      <ContextMenuTrigger className="w-full">
        <div
          className="flex items-center justify-between w-full h-20 px-1 text-sm"
          onClick={handleOrder}
        >
          <Tooltip title={`${displayName}: ${sqlType}`}>
            <div>{displayName}</div>
          </Tooltip>
          <AscOrDescIcon isDesc={isDesc} />
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-64">
        <ContextMenuItem
          onClick={async () => {
            await writeText(displayName);
          }}
        >
          Copy field name
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          icon={PinIcon}
          onClick={() => {
            pinColumn({
              colId,
              pinned: 'left',
            });
          }}
        >
          Pin to left
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => {
            pinColumn({
              colId,
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
              colId,
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
