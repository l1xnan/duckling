import { Input } from '@/components/custom/ui/input';
import { cn } from '@/lib/utils';
import { useLingui } from '@lingui/react/macro';
import { Search } from 'lucide-react';
import React from 'react';

export const SearchInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<typeof Input>
>(({ className, placeholder, ...props }, ref) => {
  const { t } = useLingui();
  return (
    <div
      className={cn(
        'relative flex items-center justify-start h-8 border-b',
        className,
      )}
    >
      <Search className={'size-4 ml-2 text-muted-foreground'} />
      <Input
        ref={ref}
        placeholder={placeholder ?? t`Search`}
        className="h-8 pl-2 py-0.5 text-xs focus-visible:ring-0 shadow-none rounded-none border-none transition-none"
        {...props}
      />
    </div>
  );
});

SearchInput.displayName = 'SearchInput';
