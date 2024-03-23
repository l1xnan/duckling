export function Favorite() {
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
            <nav className="grid items-start px-1 text-sm font-medium"></nav>
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
