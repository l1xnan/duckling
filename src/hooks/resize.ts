import { useMemo, useState } from 'react';
import useResizeObserver, { ObservedSize } from 'use-resize-observer';

import { debounce } from 'radash';

export const useDebouncedResizeObserver = (delay: number) => {
  const [size, setSize] = useState({} as ObservedSize);
  const onResize = useMemo(() => debounce({ delay }, setSize), [delay]);
  const { ref } = useResizeObserver({ onResize });

  return { ref, ...size };
};
