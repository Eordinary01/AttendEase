import React from 'react';
import { Inbox } from 'lucide-react';
import Button from './Button';

const EmptyState = ({
  title = 'No Data Available',
  description = 'Nothing here yet.',
  action,
  icon: IconComponent = Inbox,
  className = '',
}) => {
  const isElement = React.isValidElement(IconComponent);

  return (
    <div
      className={`flex flex-col items-center justify-center text-center py-10 px-4 bg-surface-subtle/50 rounded-xl border border-dashed border-line ${className}`}
    >
      <div className="w-12 h-12 rounded-xl bg-primary-soft text-primary border border-primary/20 flex items-center justify-center mb-3 shadow-xs">
        {isElement ? (
          IconComponent
        ) : typeof IconComponent === 'function' ? (
          <IconComponent className="w-6 h-6" />
        ) : (
          <Inbox className="w-6 h-6" />
        )}
      </div>
      <h3 className="text-xs font-bold text-ink mb-0.5">{title}</h3>
      {description && (
        <p className="text-[11px] text-ink-muted max-w-xs">{description}</p>
      )}
      {action && (
        <div className="mt-3">
          {React.isValidElement(action) ? (
            action
          ) : action.label && action.onClick ? (
            <Button size="sm" variant="outline" onClick={action.onClick}>
              {action.label}
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default EmptyState;
