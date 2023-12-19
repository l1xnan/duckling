import { Box } from '@mui/material';

import {
  Content,
  Layout,
  Sidebar as SidebarWrapper,
} from '@/components/Layout';
import { useResize } from '@/hooks';
import classes from '@/hooks/resize.module.css';
import { Main } from '@/pages/main';
import Sidebar from '@/pages/sidebar';
import { useDBListStore } from '@/stores/dbList';

function Home() {
  const size = useDBListStore((state) => state.size);
  const setSize = useDBListStore((state) => state.setSize);

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
