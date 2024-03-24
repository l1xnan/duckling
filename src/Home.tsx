import { useAtom } from 'jotai/react';

import { Content, Sidebar } from '@/components/Layout';
import { Hidden } from '@/components/custom/hidden';
import { useResize } from '@/hooks';
import classes from '@/hooks/resize.module.css';
import { Main } from '@/pages/main';
import DBTree from '@/pages/sidebar';
import { Favorite, History, SqlCode } from '@/pages/sidebar/Favorite.tsx';
import { ASide, activeSideAtom } from '@/pages/sidebar/aside';
import { sizeAtom } from '@/stores/app';
import { useAtomValue } from 'jotai';
import { RefObject } from 'react';

function Home() {
  const [size, setSize] = useAtom(sizeAtom);

  const [targetRefLeft, sizeLeft, actionLeft] = useResize(
    size,
    'left',
    setSize,
  );
  const activeAside = useAtomValue(activeSideAtom);
  return (
    <div className="h-full max-h-screen p-0 m-0">
      <ASide />
      <div
        ref={targetRefLeft as RefObject<HTMLDivElement>}
        className="h-full pl-9 top-0 absolute flex flex-row"
        style={{ width: sizeLeft }}
      >
        <Sidebar>
          <Hidden display={activeAside == 'database'}>
            <DBTree />
          </Hidden>
          <Hidden display={activeAside == 'favorite'}>
            <Favorite />
          </Hidden>
          <Hidden display={activeAside == 'history'}>
            <History />
          </Hidden>
          <Hidden display={activeAside == 'code'}>
            <SqlCode />
          </Hidden>
        </Sidebar>
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
