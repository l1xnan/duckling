import { Box } from '@mui/material';
import React, { ReactNode } from 'react';

import { useResize } from '@/hooks';
import classes from '@/hooks/resize.module.css';

interface VerticalContainerProps {
  children: ReactNode;
  bottom?: number;
}

export default function VerticalContainer({
  children,
  bottom,
}: VerticalContainerProps) {
  const [targetRefTop, _sizeTop, actionTop] = useResize(bottom ?? 0, 'bottom');

  const sizeTop = _sizeTop == 0 ? bottom ?? 0 : _sizeTop;
  const childrenArray = React.Children.toArray(children);

  return (
    <Box
      sx={{
        height: 'calc(100vh - 64px)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      <Box
        sx={{
          height: `calc(100vh - ${sizeTop + 64}px)`,
        }}
      >
        {childrenArray[0]}
      </Box>
      {bottom ? (
        <Box
          ref={targetRefTop}
          className={classes.rightBottom}
          sx={{ height: `${sizeTop}px`, width: '100%', minHeight: 32 }}
        >
          <div className={classes.controlsH}>
            <div className={classes.resizeHorizontal} onMouseDown={actionTop} />
          </div>
          {childrenArray[1] ?? null}
        </Box>
      ) : null}
    </Box>
  );
}
