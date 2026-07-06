import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from '../ui/sidebar';

interface SidebarNavProps extends React.HTMLAttributes<HTMLElement> {
  activeKey: string;
  setKey: (key: string) => void;
  items: {
    key: string;
    title: string;
  }[];
}

export function SidebarNav1({
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
export function SidebarNav({
  className,
  items,
  activeKey,
  setKey,
  ...props
}: SidebarNavProps) {
  return (
    <SidebarProvider>
      <Sidebar>
        {/* <SidebarContent>
          {items.map((item) => (
            <SidebarGroup
              key={item.key}
              onClick={() => {
                setKey(item.key);
              }}
              title={item.title}
            />
          ))}
        </SidebarContent> */}

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton isActive={item.key === activeKey}>
                      {item.title}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </SidebarProvider>
  );
}
