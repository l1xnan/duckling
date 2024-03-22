import { useAtom } from 'jotai/react';

import { Content, Sidebar as SidebarWrapper } from '@/components/Layout';
import { Button } from '@/components/ui/button.tsx';
import { useResize } from '@/hooks';
import classes from '@/hooks/resize.module.css';
import { Main } from '@/pages/main';
import Sidebar from '@/pages/sidebar';
import { sizeAtom } from '@/stores/app';
import { DatabaseIcon, FolderIcon, HistoryIcon } from 'lucide-react';
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
      <div className="h-full left-0 top-0 absolute flex flex-col w-8 items-center border-r">
        <Button variant="ghost" size="icon" className="rounded">
          <DatabaseIcon className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="rounded">
          <FolderIcon className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="rounded">
          <HistoryIcon className="h-4 w-4" />
        </Button>
      </div>
      <div
        ref={targetRefLeft as RefObject<HTMLDivElement>}
        className="h-full left-8 top-0 absolute flex"
        style={{ width: sizeLeft - 30 }}
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
