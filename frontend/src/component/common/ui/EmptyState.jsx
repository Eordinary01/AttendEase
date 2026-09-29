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
  // Support both React component type and JSX element
  const isElement = React.isValidElement(IconComponent);

  return (
    <div
      className={`flex flex-col items-center justify-center text-center py-12 px-6 bg-white rounded-2xl border border-slate-200/90 shadow-sm font-sans ${className}`}
    >
      <div className="w-12 h-12 rounded-2xl bg-primary-soft text-primary border border-primary-surface flex items-center justify-center mb-3 shadow-xs">
        {isElement ? (
          IconComponent
        ) : typeof IconComponent === 'function' ? (
          <IconComponent className="w-6 h-6" />
        ) : (
          <Inbox className="w-6 h-6" />
        )}
      </div>
      <h3 className="text-sm font-bold text-slate-900 mb-1">{title}</h3>
      {description && (
        <p className="text-xs text-slate-500 max-w-sm font-medium">{description}</p>
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
