import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import * as React from 'react';
import { useState } from 'react';

import { usePageStore } from '@/stores/dataset';

import { ContextMenu, ContextMenuItem } from './ContextMenu';

export interface PageSizeProps {
  content: string;
}

export default function Dropdown({ content }: PageSizeProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  const { setPerPage } = usePageStore();

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
        {content}
      </Button>
      <ContextMenu anchorEl={anchorEl} open={open} onClose={handleClose}>
        <ContextMenuItem sx={{ fontWeight: 600 }} disabled>
          Page Size
        </ContextMenuItem>
        {[10, 100, 500, 1000].map((item) => (
          <ContextMenuItem
            key={item}
            onClick={() => {
              setPerPage!(item);
              handleClose();
            }}
            disableRipple
          >
            {item}
          </ContextMenuItem>
        ))}
        <ContextMenuItem>Custom...</ContextMenuItem>
        <Divider />
        <ContextMenuItem>Change Default: 500</ContextMenuItem>
      </ContextMenu>
    </div>
  );
}
