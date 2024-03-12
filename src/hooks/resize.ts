import { useMemo, useState } from 'react';
import useResizeObserver, { ObservedSize } from 'use-resize-observer';

import { debounce } from '@/utils';

export const useDebouncedResizeObserver = (wait: number) => {
  const [size, setSize] = useState({} as ObservedSize);
  const onResize = useMemo(() => debounce(setSize, wait), [wait]);
  const { ref } = useResizeObserver({ onResize });

  return { ref, ...size };
};
