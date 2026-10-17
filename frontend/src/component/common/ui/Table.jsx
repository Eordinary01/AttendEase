import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import EmptyState from './EmptyState';
import Skeleton from './Skeleton';
import Button from './Button';

const Table = ({
  columns,
  data,
  loading = false,
  pagination,
  onPageChange,
  emptyMessage = 'No data found',
  emptyTitle = 'No Data Available',
  rowKey,
  dense = false,
  selectedId = null,
  onRowClick = null,
  caption,
  className = '',
}) => {
  if (loading) {
    return (
      <div className={`bg-surface rounded-lg border border-line overflow-hidden ${className}`}>
        <div className="p-4 space-y-3">
          <Skeleton rows={5} />
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className={`bg-surface rounded-lg border border-line overflow-hidden p-6 ${className}`}>
        <EmptyState title={emptyTitle} description={emptyMessage} />
      </div>
    );
  }

  return (
    <div className={`bg-surface rounded-lg border border-line overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead className="bg-surface-subtle border-b border-line-strong">
            <tr>
              {columns.map((col, idx) => {
                const isRight = col.numeric || col.align === 'right';
                const isCenter = col.align === 'center';
                const alignClass = isRight ? 'text-right' : isCenter ? 'text-center' : 'text-left';
                return (
                  <th
                    key={col.key || col.accessor || idx}
                    scope="col"
                    className={`h-8 px-4 text-[11px] font-semibold text-ink-muted uppercase tracking-wider whitespace-nowrap ${alignClass} ${col.className || ''}`}
                  >
                    {col.header}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data.map((row, rowIdx) => {
              const key = rowKey ? row[rowKey] : row.id || row._id || rowIdx;
              const isSelected = selectedId && (row[rowKey] === selectedId || row.id === selectedId || row._id === selectedId);
              return (
                <tr
                  key={key}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`
                    transition-colors
                    ${isSelected ? 'bg-primary-soft/70 border-l-2 border-l-primary' : 'hover:bg-primary-soft/15'}
                    ${onRowClick ? 'cursor-pointer' : ''}
                  `}
                >
                  {columns.map((col, colIdx) => {
                    const isRight = col.numeric || col.align === 'right';
                    const isCenter = col.align === 'center';
                    const alignClass = isRight ? 'text-right' : isCenter ? 'text-center' : 'text-left';
                    const tnumClass = col.numeric || col.mono ? 'tnum font-mono' : '';
                    return (
                      <td
                        key={colIdx}
                        className={`px-4 ${dense ? 'py-1.5' : 'py-2.5'} whitespace-nowrap text-sm text-ink ${alignClass} ${tnumClass} ${col.cellClassName || ''}`}
                      >
                        {col.accessor ? row[col.accessor] : col.cell ? col.cell(row) : null}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-surface-subtle border-t border-line text-xs">
          <div className="font-medium text-ink-muted">
            Showing <span className="font-mono tnum text-ink">{((pagination.page - 1) * pagination.limit) + 1}</span> to{' '}
            <span className="font-mono tnum text-ink">{Math.min(pagination.page * pagination.limit, pagination.total || 0)}</span> of{' '}
            <span className="font-mono tnum text-ink">{pagination.total || 0}</span> records
          </div>
          <div className="flex gap-1.5 items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              aria-label="Previous page"
              leftIcon={ChevronLeft}
            />
            <span className="px-2 text-xs font-mono tnum text-ink-muted">
              {pagination.page} / {pagination.pages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.pages}
              aria-label="Next page"
              leftIcon={ChevronRight}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Table;

