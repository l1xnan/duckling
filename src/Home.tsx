import { Hidden } from '@/components/custom/hidden';

import { Content, Sidebar } from '@/components/Layout';
import { useResize } from '@/hooks';
import classes from '@/hooks/resize.module.css';
import { Main } from '@/pages/main';
import DBTree from '@/pages/sidebar';
import { activeSideAtom, ASide } from '@/pages/sidebar/aside';
import { Favorite, History, SqlCode } from '@/pages/sidebar/Favorite';
import { sizeAtom } from '@/stores/app';
import { useAtomValue } from 'jotai';
import { useAtom } from 'jotai/react';
import { BellIcon } from 'lucide-react';
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
    <div className="h-screen max-h-screen p-0 m-0 flex flex-col">
      <div className="h-full p-0 m-0 flex-1 relative overflow-hidden">
        <ASide />
        <div
          ref={targetRefLeft as RefObject<HTMLDivElement>}
          className="h-full pl-9 top-0 absolute flex flex-row overflow-hidden"
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
      <StatusBar />
    </div>
  );
}

export function StatusBar() {
  return (
    <footer className="w-full h-6 min-h-6 border-t flex flex-row justify-between items-center px-2">
      <div></div>
      <BellIcon className="size-4" />
    </footer>
  );
}

export default Home;
