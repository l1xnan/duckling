import { Children, LegacyRef, PropsWithChildren } from 'react';

import { useResize } from '@/hooks';
import classes from '@/hooks/resize.module.css';

interface VerticalContainerProps {
  bottom?: number;
}

export default function VerticalContainer({
  children,
  bottom,
}: PropsWithChildren<VerticalContainerProps>) {
  const [targetRefTop, _sizeTop, actionTop] = useResize(bottom ?? 0, 'bottom');

  const sizeTop = _sizeTop == 0 ? bottom ?? 0 : _sizeTop;
  const childrenArray = Children.toArray(children);

  return (
    <div
      className="flex flex-col relative"
      style={{
        height: 'calc(100vh - 64px)',
      }}
    >
      <div
        style={{
          height: `calc(100vh - ${sizeTop + 64}px)`,
        }}
      >
        {childrenArray[0]}
      </div>
      {bottom ? (
        <div
          ref={targetRefTop as LegacyRef<HTMLDivElement>}
          className={classes.rightBottom}
          style={{ height: sizeTop, width: '100%', minHeight: 32 }}
        >
          <div className={classes.controlsH}>
            <div className={classes.resizeHorizontal} onMouseDown={actionTop} />
          </div>
          {childrenArray[1] ?? null}
        </div>
      ) : null}
    </div>
  );
}
