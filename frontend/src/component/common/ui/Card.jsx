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
  padding = 'lg',
  bordered = true,
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
          <span className="w-9 h-9 rounded-lg bg-primary-soft text-primary flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5" />
          </span>
        )}
        <div className="min-w-0">
          <h3 className="font-bold text-ink truncate leading-tight">{title}</h3>
          {subtitle && <p className="text-xs text-ink-faint truncate mt-0.5">{subtitle}</p>}
        </div>
        {titleRight}
      </div>
      {actions}
    </div>
  ) : null;

  return (
    <motion.div
      onClick={onClick}
      whileHover={hoverable ? { y: -3 } : {}}
      className={`
        bg-surface rounded-2xl shadow-card
        ${bordered ? 'border border-line' : ''}
        ${paddingClasses[padding]}
        ${hoverable ? 'transition-shadow cursor-pointer hover:shadow-cardhover' : ''}
        ${className}
      `}
    >
      {header}
      {children}
    </motion.div>
  );
};

export default Card;
