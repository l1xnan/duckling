import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import Button from '@mui/material/Button';
import * as React from 'react';
import { useState } from 'react';

import { ContextMenu, ContextMenuItem } from '@/components/ContextMenu';
import { useDBListStore } from '@/stores/dbList';

export interface DropdownProps {
  content: string;
}

export default function Connection({ content }: DropdownProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  const dbList = useDBListStore((s) => s.dbList);

  return (
    <div>
      <Button
        aria-controls={open ? 'demo-customized-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
        variant="text"
        disableElevation
        onClick={handleClick}
        sx={{ textTransform: 'none' }}
        endIcon={<KeyboardArrowDownIcon />}
      >
        {content ?? `current schema`}
      </Button>
      <ContextMenu anchorEl={anchorEl} open={open} onClose={handleClose}>
        {dbList.map((item) => (
          <ContextMenuItem
            key={item.id}
            onClick={() => {
              // TODO: update tab context
              handleClose();
            }}
            disableRipple
          >
            {item.displayName}
          </ContextMenuItem>
        ))}
      </ContextMenu>
    </div>
  );
}
