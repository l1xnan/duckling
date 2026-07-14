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


export function SidebarNav({
  className,
  items,
  activeKey,
  setKey,
  ...props
}: SidebarNavProps) {
  return (
    <SidebarProvider className="w-auto min-h-0">
      <Sidebar collapsible="none" className="w-48 bg-transparent">
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton
                      isActive={item.key === activeKey}
                      onClick={() => setKey(item.key)}
                    >
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
