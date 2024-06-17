import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SidebarNavProps extends React.HTMLAttributes<HTMLElement> {
  activeKey: string;
  setKey: (key: string) => void;
  items: {
    key: string;
    title: string;
  }[];
}

export function SidebarNav({
  className,
  items,
  activeKey,
  setKey,
  ...props
}: SidebarNavProps) {
  return (
    <nav
      className={cn(
        'flex space-x-2 lg:flex-col lg:space-x-0 lg:space-y-1',
        className,
      )}
      {...props}
    >
      {items.map((item) => (
        <div
          key={item.key}
          onClick={() => {
            setKey(item.key);
          }}
          className={cn(
            buttonVariants({ variant: 'ghost' }),
            activeKey === item.key
              ? 'bg-muted hover:bg-muted'
              : 'hover:bg-transparent hover:underline',
            'justify-start',
            'cursor-pointer',
          )}
        >
          {item.title}
        </div>
      ))}
    </nav>
  );
}
