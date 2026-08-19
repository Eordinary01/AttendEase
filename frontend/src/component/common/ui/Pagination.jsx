// src/components/common/ui/Pagination.jsx
import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Button from './Button';

const Pagination = ({ pagination, onPageChange, className = "" }) => {
  if (!pagination || !pagination.pages || pagination.pages <= 1) return null;

  const { page = 1, limit = 10, total = 0, pages = 1 } = pagination;
  const startItem = total === 0 ? 0 : (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, total);

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-2 ${className}`}>
      <p className="text-sm text-ink-soft">
        Showing <span className="font-semibold text-ink">{startItem}</span> to{' '}
        <span className="font-semibold text-ink">{endItem}</span> of{' '}
        <span className="font-semibold text-ink">{total}</span> items
      </p>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          leftIcon={ChevronLeft}
        >
          Previous
        </Button>

        <span className="text-sm text-ink-soft font-medium px-2">
          Page {page} of {pages}
        </span>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pages}
          rightIcon={ChevronRight}
        >
          Next
        </Button>
      </div>
    </div>
  );
};

export default Pagination;
