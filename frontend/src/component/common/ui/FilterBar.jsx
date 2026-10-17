import React from 'react';
import { Search } from 'lucide-react';

const FilterBar = ({
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Search records...',
  filters,
  actions,
  totalCount,
  countLabel = 'records',
  className = '',
}) => {
  return (
    <div
      className={`
        px-4 py-2.5 bg-surface-subtle border-b border-line flex flex-col md:flex-row md:items-center justify-between gap-3
        ${className}
      `}
    >
      <div className="flex flex-1 items-center gap-2.5 flex-wrap">
        {onSearchChange && (
          <div className="relative min-w-[200px] max-w-xs flex-1">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
            <input
              type="text"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="
                w-full h-7 pl-8 pr-3 text-xs bg-surface border border-line rounded text-ink
                placeholder:text-ink-faint hover:border-primary/40 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors
              "
            />
          </div>
        )}
        {filters && <div className="flex items-center gap-2 flex-wrap">{filters}</div>}
      </div>

      <div className="flex items-center gap-3 justify-between md:justify-end">
        {totalCount !== undefined && totalCount !== null && (
          <span className="text-xs font-mono tnum text-ink-muted whitespace-nowrap">
            <strong className="text-ink font-semibold">{totalCount}</strong> {countLabel}
          </span>
        )}
        {actions && <div className="flex items-center gap-1.5">{actions}</div>}
      </div>
    </div>
  );
};

export default FilterBar;
