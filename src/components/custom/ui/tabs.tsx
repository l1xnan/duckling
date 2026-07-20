import {
  Tabs,
  TabsContent,
  TabsList as UITabsList,
  TabsTrigger,
  tabsListVariants,
} from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

/** Compact: h-9 → h-8 */
function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof UITabsList>) {
  return <UITabsList className={cn('h-8', className)} {...props} />;
}

export { Tabs, TabsContent, TabsList, TabsTrigger, tabsListVariants };
