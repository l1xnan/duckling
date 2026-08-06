import { useAtom } from 'jotai';
import { Activity, RefObject } from 'react';

import { Content, Sidebar } from '@/components/Layout';
import { StatusBar } from '@/components/StatusBar';
import { useResize } from '@/hooks';
import classes from '@/hooks/resize.module.css';
import { Main } from '@/pages/main';
import { DBTree } from '@/pages/sidebar';
import { activePanelsAtom, ASide } from '@/pages/sidebar/aside';
import { Favorite, SqlCode } from '@/pages/sidebar/Favorite';
import { History } from '@/pages/sidebar/History';
import { sizeAtom, sizeRightAtom } from '@/stores/app';
import {
  resolveActiveSlots,
  resolveSidebarLayout,
  useSettingStore,
} from '@/stores/setting';

import { cn } from './lib/utils';
import { VerticalTabs } from './pages/sidebar/VerticalTabs';

const ACTIVITIES = [
  { id: 'database', component: DBTree },
  { id: 'favorite', component: Favorite },
  { id: 'history', component: History },
  { id: 'code', component: SqlCode },
  { id: 'tabs', component: VerticalTabs },
] as const;

const RAIL_WIDTH = 36;

function Home() {
  const [leftStoreSize, setLeftSize] = useAtom(sizeAtom);
  const [rightStoreSize, setRightSize] = useAtom(sizeRightAtom);
  const [activePanels] = useAtom(activePanelsAtom);
  const sidebar = useSettingStore((s) => s.sidebar);

  const layout = resolveSidebarLayout(sidebar);
  const slots = resolveActiveSlots(activePanels, layout);
  const leftPanelId = slots.left;
  const rightPanelId = slots.right;

  const [targetRefLeft, sizeLeft, actionLeft] = useResize(
    leftStoreSize,
    'left',
    setLeftSize,
  );
  const [targetRefRight, sizeRight, actionRight] = useResize(
    rightStoreSize,
    'right',
    setRightSize,
  );

  const leftReserve =
    (leftPanelId != null ? sizeLeft : 0) +
    (layout.side === 'left' && leftPanelId == null ? RAIL_WIDTH : 0);
  const rightReserve =
    (rightPanelId != null ? sizeRight : 0) +
    (layout.side === 'right' && rightPanelId == null ? RAIL_WIDTH : 0);

  return (
    <div className="h-screen max-h-screen p-0 m-0 flex flex-col">
      <div className="h-full p-0 m-0 flex-1 relative overflow-hidden">
        <ASide />
        {leftPanelId != null ? (
          <div
            ref={targetRefLeft as RefObject<HTMLDivElement>}
            className="h-full top-0 absolute pl-9 left-0 flex flex-row overflow-hidden"
            style={{ width: sizeLeft }}
          >
            <Sidebar side="left">
              {ACTIVITIES.filter(({ id }) => id === leftPanelId).map(
                ({ id, component: Component }) => (
                  <Activity key={id} mode="visible">
                    <Component />
                  </Activity>
                ),
              )}
            </Sidebar>
            <div className={classes.controls}>
              <div className={classes.resizeVertical} onMouseDown={actionLeft} />
            </div>
          </div>
        ) : null}
        {rightPanelId != null ? (
          <div
            ref={targetRefRight as RefObject<HTMLDivElement>}
            className="h-full flex flex-row overflow-hidden top-0 absolute right-0 pr-1"
            style={{ width: sizeRight }}
          >
            <Sidebar side="right">
              {ACTIVITIES.filter(({ id }) => id === rightPanelId).map(
                ({ id, component: Component }) => (
                  <Activity key={id} mode="visible">
                    <Component />
                  </Activity>
                ),
              )}
            </Sidebar>
            <div className={cn(classes.controls, classes.controlsLeft)}>
              <div className={classes.resizeVertical} onMouseDown={actionRight} />
            </div>
          </div>
        ) : null}
        <Content style={{ marginLeft: leftReserve, marginRight: rightReserve }}>
          <Main />
        </Content>
      </div>
      <StatusBar />
    </div>
  );
}

export default Home;
