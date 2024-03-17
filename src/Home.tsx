import { useAtom } from 'jotai/react';

import { Content, Sidebar as SidebarWrapper } from '@/components/Layout';
import { useResize } from '@/hooks';
import classes from '@/hooks/resize.module.css';
import { Main } from '@/pages/main';
import Sidebar from '@/pages/sidebar';
import { sizeAtom } from '@/stores/app';
import { RefObject } from 'react';

function Home() {
  const [size, setSize] = useAtom(sizeAtom);

  const [targetRefLeft, sizeLeft, actionLeft] = useResize(
    size,
    'left',
    setSize,
  );

  return (
    <div className="h-full max-h-screen p-0 m-0">
      <div
        ref={targetRefLeft as RefObject<HTMLDivElement>}
        className="h-full left-0 top-0 absolute flex"
        style={{ width: sizeLeft }}
      >
        <SidebarWrapper>
          <Sidebar />
        </SidebarWrapper>
        <div className={classes.controls}>
          <div className={classes.resizeVertical} onMouseDown={actionLeft} />
        </div>
      </div>
      <Content style={{ marginLeft: sizeLeft }}>
        <Main />
      </Content>
    </div>
  );
}

export default Home;
