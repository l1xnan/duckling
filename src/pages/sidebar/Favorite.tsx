import { favoriteAtom } from '@/stores/app';
import { useAtomValue } from 'jotai';
import { Code2Icon, SearchIcon, TableIcon } from 'lucide-react';

export function Favorite() {
  const items = useAtomValue(favoriteAtom);
  return (
    <div className="grid min-h-screen w-full">
      <div className="hidden border-r bg-muted/40 md:block">
        <div className="flex h-full max-h-screen flex-col gap-2">
          <div className="flex h-8 items-center border-b px-4">
            <a className="flex items-center gap-2 font-semibold">
              <span className="">Favorite</span>
            </a>
          </div>
          <div className="flex-1">
            <nav className="grid items-start px-1 text-sm">
              {items.map((item, i) => {
                const Comp =
                  item.type == 'search'
                    ? SearchIcon
                    : item.type == 'editor'
                      ? Code2Icon
                      : TableIcon;
                return (
                  <a
                    key={i}
                    href="#"
                    className="flex items-center rounded-lg px-2 py-1 text-muted-foreground transition-all hover:text-primary overflow-hidden"
                  >
                    <Comp className="size-4 min-w-4 mr-1" />
                    <div className="overflow-hidden text-ellipsis font-mono font-normal whitespace-nowrap">
                      {item.displayName}
                    </div>
                  </a>
                );
              })}
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
}

export function History() {
  return (
    <div className="grid min-h-screen w-full">
      <div className="hidden border-r bg-muted/40 md:block">
        <div className="flex h-full max-h-screen flex-col gap-2">
          <div className="flex h-8 items-center border-b px-4">
            <a className="flex items-center gap-2 font-semibold">
              <span className="">History</span>
            </a>
          </div>
          <div className="flex-1">
            <nav className="grid items-start px-1 text-sm font-medium"></nav>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SqlCode() {
  return (
    <div className="grid min-h-screen w-full">
      <div className="hidden border-r bg-muted/40 md:block">
        <div className="flex h-full max-h-screen flex-col gap-2">
          <div className="flex h-8 items-center border-b px-4">
            <a className="flex items-center gap-2 font-semibold">
              <span className="">Code</span>
            </a>
          </div>
          <div className="flex-1">
            <nav className="grid items-start px-1 text-sm font-medium"></nav>
          </div>
        </div>
      </div>
    </div>
  );
}
