import { useAtom, useAtomValue } from 'jotai';
import { BellIcon } from 'lucide-react';
import { Activity, RefObject } from 'react';

import { Content, Sidebar } from '@/components/Layout';
import { useResize } from '@/hooks';
import classes from '@/hooks/resize.module.css';
import { Main } from '@/pages/main';
import { DBTree } from '@/pages/sidebar';
import { activeSideAtom, ASide } from '@/pages/sidebar/aside';
import { Favorite, History, SqlCode } from '@/pages/sidebar/Favorite';
import { sizeAtom } from '@/stores/app';

import { cn } from './lib/utils';
import { VerticalTabs } from './pages/sidebar/VerticalTabs';

const ACTIVITIES = [
  { id: 'database', component: DBTree },
  { id: 'favorite', component: Favorite },
  { id: 'history', component: History },
  { id: 'code', component: SqlCode },
  { id: 'tabs', component: VerticalTabs },
] as const;

function Home() {
  const [size, setSize] = useAtom(sizeAtom);
  const [activeSide] = useAtom(activeSideAtom);

  const [targetRefLeft, sizeLeft, actionLeft] = useResize(
    size,
    'left',
    setSize,
  );

  return (
    <div className="h-screen max-h-screen p-0 m-0 flex flex-col">
      <div className="h-full p-0 m-0 flex-1 relative overflow-hidden">
        <ASide />
        <div
          ref={targetRefLeft as RefObject<HTMLDivElement>}
          className={cn(
            'h-full pl-9 top-0 absolute flex flex-row overflow-hidden',
            !activeSide ? 'hidden' : null,
          )}
          style={{ width: sizeLeft }}
        >
          <Sidebar>
            {ACTIVITIES.map(({ id, component: Component }) => (
              <Activity
                key={id}
                mode={activeSide === id ? 'visible' : 'hidden'}
              >
                <Component />
              </Activity>
            ))}
          </Sidebar>
          <div className={classes.controls}>
            <div className={classes.resizeVertical} onMouseDown={actionLeft} />
          </div>
        </div>
        <Content
          className={!activeSide ? 'ml-9' : ''}
          style={!activeSide ? undefined : { marginLeft: sizeLeft }}
        >
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
