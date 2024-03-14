import { Box } from '@mui/material';
import { useAtom } from 'jotai/react';

import { Content, Sidebar as SidebarWrapper } from '@/components/Layout';
import { useResize } from '@/hooks';
import classes from '@/hooks/resize.module.css';
import { Main } from '@/pages/main';
import Sidebar from '@/pages/sidebar';
import { sizeAtom } from '@/stores/app';

function Home() {
  const [size, setSize] = useAtom(sizeAtom);

  const [targetRefLeft, sizeLeft, actionLeft] = useResize(
    size,
    'left',
    setSize,
  );

  return (
    <div className="h-full max-h-screen p-0 m-0">
      <Box
        ref={targetRefLeft}
        className={classes.sideBar}
        sx={{ width: sizeLeft + 'px' }}
      >
        <SidebarWrapper>
          <Sidebar />
        </SidebarWrapper>
        <div className={classes.controls}>
          <div className={classes.resizeVertical} onMouseDown={actionLeft} />
        </div>
      </Box>
      <Content style={{ marginLeft: sizeLeft }}>
        <Main />
      </Content>
    </div>
  );
}

export default Home;
