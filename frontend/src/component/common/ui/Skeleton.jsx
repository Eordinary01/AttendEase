import React from 'react';

const Skeleton = ({ rows = 1, className = '' }) => {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-4 bg-white/[0.06] rounded-full animate-pulse" style={{ width: `${100 - (i % 4) * 12}%` }} />
      ))}
    </div>
  );
};

export default Skeleton;
