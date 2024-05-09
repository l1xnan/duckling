import { PrimitiveAtom, useSetAtom } from "jotai";
import { focusAtom } from "jotai-optics";
import * as O from "optics-ts";
import { MouseEventHandler, MutableRefObject, useCallback, useRef, useState } from "react";

type ResizeType = 'top' | 'bottom' | 'right' | 'left';

export const useResize = (
  initialSize: number,
  type: ResizeType,
  cb?: (size: number) => void,
): [
  MutableRefObject<HTMLElement | null>,
  number,
  MouseEventHandler<HTMLElement>,
] => {
  const targetRef: MutableRefObject<HTMLElement | null> = useRef(null);
  const [size, setSize] = useState(initialSize);

  const callback = (size: number) => {
    setSize(size);
    cb?.(size);
  };

  const onMouseDownHandler: MouseEventHandler<HTMLElement> = (e) => {
    e.preventDefault();
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('mouseleave', onMouseUp);
    switch (type) {
      case 'top':
      case 'bottom': {
        document.body.style.cursor = 'ns-resize';
        break;
      }
      case 'right':
      case 'left': {
        document.body.style.cursor = 'e-resize';
        break;
      }
      default:
        throw new Error('Wrong type');
    }
  };

  const onMouseMove = (e: MouseEvent) => {
    if (targetRef.current) {
      targetRef.current.style.opacity = '60%';
      switch (type) {
        case 'top': {
          callback(e.clientY);
          break;
        }
        case 'bottom': {
          callback(window.innerHeight - e.clientY);
          break;
        }
        case 'right': {
          callback(window.innerWidth - e.clientX);
          break;
        }
        case 'left': {
          callback(e.clientX);
          break;
        }
        default:
          throw new Error('Wrong type');
      }
    }
  };

  const onMouseUp = () => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    document.removeEventListener('mouseleave', onMouseUp);
    document.body.style.cursor = 'default';
    if (targetRef.current) {
      targetRef.current.style.opacity = '100%';
    }
  };

  return [targetRef, size, onMouseDownHandler];
};
export function useFocusAtom<T, K extends keyof T>(anAtom: PrimitiveAtom<T>, key: K) {
  return useSetAtom(
    focusAtom(
      anAtom,
      useCallback((optic: O.OpticFor_<T>) => optic.prop(key), [])
    )
  );
}
