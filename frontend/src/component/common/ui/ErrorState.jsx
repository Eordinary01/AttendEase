import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import Button from './Button';

const ErrorState = ({
  title = 'Data Unavailable',
  message = 'Failed to load records from the registry. Please check your connection or retry.',
  onRetry,
  compact = false,
  className = '',
}) => {
  return (
    <div
      role="alert"
      className={`
        rounded-lg border border-status-error-border bg-status-error-bg
        flex flex-col sm:flex-row sm:items-center justify-between gap-4
        ${compact ? 'p-3 text-xs' : 'p-4 text-sm'}
        ${className}
      `}
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded bg-status-error-border/60 text-status-error-text flex items-center justify-center flex-shrink-0">
          <AlertCircle className="w-4 h-4" />
        </div>
        <div>
          <h4 className="font-semibold text-status-error-text">
            {title}
          </h4>
          <p className="text-status-error-text/90 mt-0.5">
            {message}
          </p>
        </div>
      </div>

      {onRetry && (
        <Button
          variant="outline"
          size={compact ? 'sm' : 'md'}
          onClick={onRetry}
          leftIcon={RefreshCw}
          className="border-status-error-border text-status-error-text hover:bg-status-error-border/20 self-start sm:self-center"
        >
          Retry
        </Button>
      )}
    </div>
  );
};

export default ErrorState;
