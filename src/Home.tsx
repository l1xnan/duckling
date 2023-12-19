import { Box } from '@mui/material';
import { useAtom } from 'jotai/react';

import {
  Content,
  Layout,
  Sidebar as SidebarWrapper,
} from '@/components/Layout';
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
    <Layout>
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
      <Content sx={{ ml: `${sizeLeft}px` }}>
        <Main />
      </Content>
    </Layout>
  );
}

export default Home;
