import React from 'react';
import { Inbox } from 'lucide-react';

const EmptyState = ({ title = 'No Data Available', description = 'Nothing here yet.', action, icon: Icon = Inbox, className = '' }) => {
  return (
    <div className={`flex flex-col items-center justify-center text-center py-16 px-6 bg-surface rounded-2xl border border-dashed border-line ${className}`}>
      <div className="w-14 h-14 rounded-2xl bg-background flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-ink-faint" />
      </div>
      <h3 className="text-lg font-bold text-ink mb-1">{title}</h3>
      <p className="text-sm text-ink-faint max-w-sm">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
};

export default EmptyState;
