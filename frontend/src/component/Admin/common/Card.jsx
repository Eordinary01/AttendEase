// src/components/Admin/common/Card.jsx
import React from 'react';

const Card = ({ 
  children, 
  className = '', 
  onClick,
  hoverable = false,
  padding = 'lg',
  bordered = false,
}) => {
  const paddingClasses = {
    none: '',
    sm: 'p-4',
    md: 'p-5',
    lg: 'p-6',
    xl: 'p-8',
  };

  return (
    <div
      onClick={onClick}
      className={`
        bg-white rounded-xl shadow-sm
        ${paddingClasses[padding]}
        ${bordered ? 'border border-gray-200' : ''}
        ${hoverable ? 'hover:shadow-md hover:-translate-y-1 transition-all cursor-pointer' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
};

export default Card;