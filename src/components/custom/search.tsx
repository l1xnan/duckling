import { Input, InputProps } from '@/components/ui/input';
import { cn } from '@/lib/utils.ts';
import { Search } from 'lucide-react';
import React from 'react';

export const SearchInput = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
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
          placeholder="Search"
          className="h-8 pl-2 py-0.5 text-xs focus-visible:ring-0 shadow-none rounded-none border-none transition-none"
          {...props}
        />
      </div>
    );
  },
);

SearchInput.displayName = 'SearchInput';
