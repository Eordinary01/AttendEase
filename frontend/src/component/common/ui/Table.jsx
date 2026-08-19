import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import EmptyState from './EmptyState';
import Skeleton from './Skeleton';

const Table = ({
  columns,
  data,
  loading = false,
  pagination,
  onPageChange,
  emptyMessage = 'No data found',
  emptyTitle = 'No Data Available',
  rowKey,
}) => {
  if (loading) {
    return (
      <div className="bg-surface rounded-2xl border border-line overflow-hidden">
        <div className="p-6 space-y-4">
          <Skeleton rows={5} />
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyMessage} />;
  }

  return (
    <div className="bg-surface rounded-2xl border border-line overflow-hidden shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-background/80 border-b border-line">
            <tr>
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  className="px-6 py-3.5 text-left text-xs font-bold text-ink-faint uppercase tracking-wider whitespace-nowrap"
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data.map((row, rowIdx) => (
              <tr
                key={rowKey ? row[rowKey] : rowIdx}
                className="hover:bg-background/70 transition-colors"
              >
                {columns.map((col, colIdx) => (
                  <td key={colIdx} className="px-6 py-4 whitespace-nowrap text-sm text-ink font-medium">
                    {col.accessor ? row[col.accessor] : col.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-between px-6 py-4 bg-background/60 border-t border-line">
          <div className="text-sm font-medium text-ink-faint">
            Showing <span className="text-ink">{((pagination.page - 1) * pagination.limit) + 1}</span> to{' '}
            <span className="text-ink">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> of{' '}
            <span className="text-ink">{pagination.total}</span> results
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="p-2 rounded-lg bg-surface border border-line text-ink-soft hover:bg-background hover:text-ink disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page === pagination.pages}
              className="p-2 rounded-lg bg-surface border border-line text-ink-soft hover:bg-background hover:text-ink disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Table;
