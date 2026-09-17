import { ClauseHistoryPopover } from '@/components/custom/ClauseHistoryPopover';
import { Input } from '@/components/custom/ui/input';
import { cn } from '@/lib/utils';
import { useLingui } from '@lingui/react/macro';
import { Search } from 'lucide-react';
import React from 'react';

export type SearchInputHistoryProps = {
  terms: string[];
  ariaLabel: string;
  recentLabel: string;
  emptyLabel: string;
  onSelect: (term: string) => void;
  onRemove: (term: string) => void;
  onClear: () => void;
};

export const SearchInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<typeof Input> & {
    history?: SearchInputHistoryProps;
  }
>(({ className, placeholder, history, ...props }, ref) => {
  const { t } = useLingui();
  return (
    <div
      className={cn(
        'relative flex items-center justify-start h-8 border-b',
        className,
      )}
    >
      {history ? (
        <ClauseHistoryPopover
          icon={Search}
          terms={history.terms}
          ariaLabel={history.ariaLabel}
          recentLabel={history.recentLabel}
          emptyLabel={history.emptyLabel}
          onSelect={history.onSelect}
          onRemove={history.onRemove}
          onClear={history.onClear}
          triggerClassName="ml-1"
          contentAlign="start"
        />
      ) : (
        <Search className="size-4 ml-2 text-muted-foreground" />
      )}
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
