import { Box, BoxProps } from '@mui/material';
import { styled } from '@mui/material/styles';

import { Content, Layout, Sidebar } from '@/components/Layout';
import { useResize } from '@/hooks';
import classes from '@/hooks/resize.module.css';
import SidebarTree from '@/pages/sidebar';
import { useDBListStore } from '@/stores/dbList';

export const DatasetEmpty = styled((props) => <Box {...props} />)<BoxProps>(
  () => ({
    display: 'flex',
    marginTop: '20%',
    height: '100%',
    justifyContent: 'center',
  }),
);

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
        <Sidebar>
          <SidebarTree />
        </Sidebar>
        <div className={classes.controls}>
          <div className={classes.resizeVertical} onMouseDown={actionLeft} />
        </div>
      </Box>
      <Content sx={{ ml: `${sizeLeft}px` }}>
        <Content />
      </Content>
    </Layout>
  );
}

export default Home;
