import React from 'react';
import { motion } from 'framer-motion';

const paddingClasses = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
  xl: 'p-8',
};

const Card = ({
  children,
  className = '',
  onClick,
  hoverable = false,
  padding = 'md',
  bordered = true,
  highlight = false,
  title,
  subtitle,
  icon: Icon,
  titleRight,
  actions,
}) => {
  const header = title ? (
    <div className="flex items-center justify-between gap-3 mb-4">
      <div className="flex items-center gap-2.5 min-w-0">
        {Icon && (
          <span className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4" />
          </span>
        )}
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-ink truncate leading-tight">{title}</h3>
          {subtitle && <p className="text-xs text-ink-soft truncate mt-0.5">{subtitle}</p>}
        </div>
        {titleRight}
      </div>
      {actions}
    </div>
  ) : null;

  return (
    <motion.div
      onClick={onClick}
      whileHover={hoverable ? { y: -2 } : {}}
      className={`
        bg-surface rounded-2xl
        ${bordered ? (highlight ? 'border border-line/70 shadow-sm' : 'border border-line/50') : ''}
        ${paddingClasses[padding]}
        ${hoverable ? 'transition-all cursor-pointer hover:border-primary/40' : ''}
        ${className}
      `}
    >
      {header}
      {children}
    </motion.div>
  );
};

export default Card;
