import {
  MouseEventHandler,
  RefObject,
  useRef,
  useState,
} from 'react';

type ResizeType = 'top' | 'bottom' | 'right' | 'left';

export const useResize = (
  initialSize: number,
  type: ResizeType,
  cb?: (size: number) => void,
): [RefObject<HTMLElement | null>, number, MouseEventHandler<HTMLElement>] => {
  const targetRef: RefObject<HTMLElement | null> = useRef(null);
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
      // Prefer parent bounds so nested splits (editor groups) measure correctly.
      const parent = targetRef.current.parentElement;
      const parentRect = parent?.getBoundingClientRect();
      switch (type) {
        case 'top': {
          if (parentRect) {
            callback(Math.max(0, e.clientY - parentRect.top));
          } else {
            callback(e.clientY);
          }
          break;
        }
        case 'bottom': {
          if (parentRect) {
            callback(Math.max(32, parentRect.bottom - e.clientY));
          } else {
            callback(window.innerHeight - e.clientY);
          }
          break;
        }
        case 'right': {
          if (parentRect) {
            callback(Math.max(0, parentRect.right - e.clientX));
          } else {
            callback(window.innerWidth - e.clientX);
          }
          break;
        }
        case 'left': {
          if (parentRect) {
            callback(Math.max(0, e.clientX - parentRect.left));
          } else {
            callback(e.clientX);
          }
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
}
