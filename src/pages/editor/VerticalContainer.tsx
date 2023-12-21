import { Box } from '@mui/material';
import React, { ReactNode } from 'react';

import { useResize } from '@/hooks';
import classes from '@/hooks/resize.module.css';

export default function VerticalContainer(props: {
  children: ReactNode;
  bottom?: number;
}) {
  const [targetRefTop, sizeTop, actionTop] = useResize(
    props.bottom ?? 0,
    'bottom',
  );
  const childrenArray = React.Children.toArray(props.children);

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
      {props.bottom ? (
        <Box
          ref={targetRefTop}
          className={classes.rightBottom}
          sx={{ height: `${sizeTop}px`, width: '100%' }}
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
